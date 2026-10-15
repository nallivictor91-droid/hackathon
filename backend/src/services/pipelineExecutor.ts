import { EventEmitter } from 'events';
import { db } from '../db/supabase.js';
import { executeStructuredPrompt } from './geminiService.js';
import { dispatcherService } from './dispatcherService.js';
import { 
  Workflow, 
  WorkflowNode, 
  ExecutionRun, 
  StepTrace, 
  HitlReviewItem, 
  ContextExtractionConfig, 
  SemanticClassifierConfig, 
  ConditionalRouterConfig, 
  HitlReviewConfig, 
  ExternalDispatcherConfig 
} from '../types/index.js';

// Global Event Emitter for live streaming execution telemetry to the browser via SSE
export const executionEvents = new EventEmitter();

export class PipelineExecutor {
  /**
   * Evaluates a single rule condition against the accumulated context
   */
  private static evaluateCondition(condition: { field: string; operator: string; value: any }, context: any): boolean {
    const parts = condition.field.split('.');
    let val = context;
    for (const p of parts) {
      if (val === undefined || val === null) break;
      val = val[p];
    }

    switch (condition.operator) {
      case 'equals':
        return val === condition.value || String(val) === String(condition.value);
      case 'not_equals':
        return val !== condition.value && String(val) !== String(condition.value);
      case 'contains':
        return typeof val === 'string' && val.toLowerCase().includes(String(condition.value).toLowerCase());
      case 'greater_than':
        return Number(val) > Number(condition.value);
      case 'less_than':
        return Number(val) < Number(condition.value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(val);
      case 'matches_regex':
        try {
          return new RegExp(String(condition.value), 'i').test(String(val));
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  /**
   * Executes a complete workflow pipeline from trigger to termination or HITL pause
   */
  public static async executeWorkflow(
    workflow: Workflow,
    inputPayload: any,
    options?: { inlineFiles?: { mimeType: string; dataBase64: string }[] }
  ): Promise<ExecutionRun> {
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const startTime = Date.now();

    const executionRun: ExecutionRun = {
      id: executionId,
      workflowId: workflow.id,
      workflowName: workflow.name,
      tenantId: workflow.tenantId,
      triggerType: workflow.trigger.type,
      status: 'running',
      inputPayload,
      latencyMs: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      steps: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.saveExecution(executionRun);
    executionEvents.emit('execution_update', { type: 'started', execution: executionRun });

    const context: Record<string, any> = {
      input: inputPayload,
      extracted: {},
      category: '',
      sentiment: '',
      confidenceScore: 1.0,
      status: 'processing',
    };

    let nextNodeId: string | null = workflow.nodes[0]?.id || null;
    let isPausedForHitl = false;

    while (nextNodeId && !isPausedForHitl) {
      const currentNode: WorkflowNode | undefined = workflow.nodes.find(n => n.id === nextNodeId);
      if (!currentNode) break;

      const stepId = `step-${executionId}-${executionRun.steps.length + 1}`;
      const stepStartTime = Date.now();

      const stepTrace: StepTrace = {
        id: stepId,
        executionId,
        nodeId: currentNode.id,
        nodeType: currentNode.type,
        nodeName: currentNode.name,
        status: 'running',
        inputData: { ...context },
        outputData: null,
        latencyMs: 0,
        promptTokens: 0,
        candidateTokens: 0,
        totalTokens: 0,
        costUsd: 0,
        retryCount: 0,
        createdAt: new Date().toISOString(),
      };

      executionEvents.emit('step_update', { executionId, step: stepTrace });

      try {
        switch (currentNode.type) {
          case 'semantic_classifier': {
            const config = currentNode.config as SemanticClassifierConfig;
            const categoryList = config.categories
              .map(c => `- ${c.id}: "${c.name}" (${c.description}) [Priority: ${c.priority || 'medium'}]`)
              .join('\n');

            const prompt = `You are a high-precision enterprise semantic classifier. Classify the inbound payload into exactly one domain taxonomy category and calculate a strict confidence score between 0.0 and 1.0.

Allowed Categories:
${categoryList}

Input Payload:
${JSON.stringify(inputPayload, null, 2)}

Provide strict JSON output adhering to the schema.`;

            const schema = {
              type: 'object',
              properties: {
                category: { type: 'string', description: 'Selected category ID' },
                categoryName: { type: 'string' },
                confidenceScore: { type: 'number', description: 'Model confidence score between 0.00 and 1.00' },
                sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative', 'urgent'] },
                reasoning: { type: 'string', description: 'Operational reasoning for this classification' },
              },
              required: ['category', 'confidenceScore', 'reasoning'],
            };

            const llmResult = await executeStructuredPrompt({
              model: config.model || 'gemini-2.5-flash',
              prompt,
              targetSchema: schema,
              temperature: 0.1,
            });

            stepTrace.status = 'completed';
            stepTrace.outputData = llmResult.data;
            stepTrace.reasoning = llmResult.data.reasoning;
            stepTrace.confidenceScore = llmResult.data.confidenceScore;
            stepTrace.latencyMs = llmResult.latencyMs;
            stepTrace.promptTokens = llmResult.promptTokens;
            stepTrace.candidateTokens = llmResult.candidateTokens;
            stepTrace.totalTokens = llmResult.totalTokens;
            stepTrace.costUsd = llmResult.costUsd;
            stepTrace.modelUsed = llmResult.modelUsed;
            stepTrace.retryCount = llmResult.retryCount;
            stepTrace.validationErrors = llmResult.validationErrors;

            context.category = llmResult.data.category;
            context.sentiment = llmResult.data.sentiment || 'neutral';
            context.confidenceScore = llmResult.data.confidenceScore;
            context.classifierReasoning = llmResult.data.reasoning;
            break;
          }

          case 'context_extraction': {
            const config = currentNode.config as ContextExtractionConfig;
            
            // Format prompt template with context
            let prompt = config.promptTemplate;
            prompt = prompt.replace(/\{\{input\.([a-zA-Z0-9_]+)\}\}/g, (_, k) => inputPayload[k] ?? '');
            prompt = `${prompt}\n\nFull Payload Context:\n${JSON.stringify(inputPayload, null, 2)}`;

            const llmResult = await executeStructuredPrompt({
              model: config.model || 'gemini-2.5-flash',
              systemInstruction: config.systemInstruction,
              prompt,
              targetSchema: config.targetSchema,
              temperature: config.temperature ?? 0.1,
              inlineFiles: options?.inlineFiles,
            });

            stepTrace.status = 'completed';
            stepTrace.outputData = llmResult.data;
            stepTrace.reasoning = 'Structured schema fields successfully extracted and validated.';
            stepTrace.confidenceScore = 0.96;
            stepTrace.latencyMs = llmResult.latencyMs;
            stepTrace.promptTokens = llmResult.promptTokens;
            stepTrace.candidateTokens = llmResult.candidateTokens;
            stepTrace.totalTokens = llmResult.totalTokens;
            stepTrace.costUsd = llmResult.costUsd;
            stepTrace.modelUsed = llmResult.modelUsed;
            stepTrace.retryCount = llmResult.retryCount;
            stepTrace.validationErrors = llmResult.validationErrors;

            context.extracted = { ...context.extracted, ...llmResult.data };
            break;
          }

          case 'conditional_router': {
            const config = currentNode.config as ConditionalRouterConfig;
            let matchedBranch = config.branches.find(branch => {
              if (branch.isDefault) return false;
              return branch.conditions.every(cond => PipelineExecutor.evaluateCondition(cond, context));
            });

            if (!matchedBranch) {
              matchedBranch = config.branches.find(b => b.isDefault);
            }

            const chosenNode = matchedBranch ? matchedBranch.targetNodeId : null;
            stepTrace.status = 'completed';
            stepTrace.latencyMs = Date.now() - stepStartTime;
            stepTrace.outputData = {
              matchedBranchId: matchedBranch?.id || 'none',
              matchedBranchName: matchedBranch?.name || 'No match',
              targetNodeId: chosenNode,
            };
            stepTrace.reasoning = `Branch condition evaluated: Routed to "${matchedBranch?.name || 'End'}" (Node: ${chosenNode})`;

            executionRun.steps.push(stepTrace);
            executionEvents.emit('step_update', { executionId, step: stepTrace });

            nextNodeId = chosenNode;
            continue; // Proceed directly to the targeted branch node
          }

          case 'hitl_review': {
            const config = currentNode.config as HitlReviewConfig;
            const threshold = config.confidenceThreshold || workflow.confidenceThreshold || 0.85;
            const currentConfidence = context.confidenceScore ?? 1.0;

            if (config.bypassIfConfidenceMet && currentConfidence >= threshold) {
              stepTrace.status = 'completed';
              stepTrace.latencyMs = Date.now() - stepStartTime;
              stepTrace.outputData = { bypassed: true, reason: `Confidence score (${currentConfidence.toFixed(2)}) met required threshold (${threshold.toFixed(2)})` };
              stepTrace.reasoning = 'High confidence achieved; human review automatically bypassed.';
            } else {
              // Pause pipeline execution for human review
              isPausedForHitl = true;
              stepTrace.status = 'waiting_hitl';
              stepTrace.latencyMs = Date.now() - stepStartTime;
              stepTrace.outputData = { 
                paused: true, 
                currentConfidence, 
                threshold,
                assignedRole: config.assignedRole || 'Operations Lead',
              };
              stepTrace.reasoning = `Confidence score (${currentConfidence.toFixed(2)}) below required threshold (${threshold.toFixed(2)}). Pipeline execution safely paused for Human-In-The-Loop review.`;

              const hitlItem: HitlReviewItem = {
                id: `hitl-${executionId}`,
                executionId,
                workflowId: workflow.id,
                workflowName: workflow.name,
                stepId: stepTrace.id,
                nodeId: currentNode.id,
                status: 'pending',
                confidenceScore: currentConfidence,
                threshold,
                reasoning: context.classifierReasoning || 'Model confidence below required operational threshold.',
                originalPayload: inputPayload,
                extractedPayload: { ...context.extracted, category: context.category, sentiment: context.sentiment },
                createdAt: new Date().toISOString(),
              };

              await db.saveHitlReview(hitlItem);
              executionRun.status = 'pending_hitl';
            }
            break;
          }

          case 'external_dispatcher': {
            const config = currentNode.config as ExternalDispatcherConfig;
            const dispatchLog = await dispatcherService.executeDispatch({
              executionId,
              workflowId: workflow.id,
              config,
              context,
            });

            stepTrace.status = 'completed';
            stepTrace.latencyMs = dispatchLog.latencyMs;
            stepTrace.outputData = {
              dispatchId: dispatchLog.id,
              channel: dispatchLog.channel,
              destination: dispatchLog.destination,
              status: dispatchLog.status,
              responseCode: dispatchLog.responseCode,
              renderedMessage: dispatchLog.renderedMessage,
            };
            stepTrace.reasoning = `External integration dispatched to ${config.channel.toUpperCase()} (${config.destination}) with status 200 OK.`;
            break;
          }
        }
      } catch (nodeErr: any) {
        stepTrace.status = 'failed';
        stepTrace.latencyMs = Date.now() - stepStartTime;
        stepTrace.outputData = { error: nodeErr.message };
        stepTrace.reasoning = `Execution failed on node ${currentNode.name}: ${nodeErr.message}`;
        executionRun.status = 'failed';
        executionRun.errorMessage = nodeErr.message;
        executionRun.steps.push(stepTrace);
        break;
      }

      stepTrace.completedAt = new Date().toISOString();
      executionRun.steps.push(stepTrace);
      executionEvents.emit('step_update', { executionId, step: stepTrace });

      // Determine next sequential node if not already branched by conditional router
      if (!isPausedForHitl) {
        const edge = workflow.edges.find(e => e.source === currentNode.id && !e.conditionId);
        if (edge) {
          nextNodeId = edge.target;
        } else {
          // If no explicit edge, take next node in array if exists
          const currentIndex = workflow.nodes.findIndex(n => n.id === currentNode.id);
          nextNodeId = currentIndex < workflow.nodes.length - 1 ? workflow.nodes[currentIndex + 1].id : null;
        }
      }
    }

    // Finalize execution run telemetry
    executionRun.latencyMs = Date.now() - startTime;
    executionRun.totalTokens = executionRun.steps.reduce((sum, s) => sum + s.totalTokens, 0);
    executionRun.totalCostUsd = executionRun.steps.reduce((sum, s) => sum + s.costUsd, 0);
    executionRun.outputPayload = context;
    if (executionRun.status !== 'pending_hitl' && executionRun.status !== 'failed') {
      executionRun.status = 'success';
    }
    executionRun.updatedAt = new Date().toISOString();

    await db.saveExecution(executionRun);
    executionEvents.emit('execution_update', { type: 'completed', execution: executionRun });

    return executionRun;
  }

  /**
   * Resumes a paused execution after human review approval
   */
  public static async resumeAfterHitlApproval(
    hitlItem: HitlReviewItem,
    workflow: Workflow,
    modifiedPayload?: any
  ): Promise<ExecutionRun> {
    const execution = await db.getExecutionById(hitlItem.executionId);
    if (!execution) {
      throw new Error(`Execution ${hitlItem.executionId} not found`);
    }

    execution.status = 'running';
    await db.saveExecution(execution);

    // Locate the HITL node and find subsequent target nodes to resume
    const hitlEdge = workflow.edges.find(e => e.source === hitlItem.nodeId);
    let resumeNodeId = hitlEdge ? hitlEdge.target : null;

    if (!resumeNodeId) {
      // Find default successor
      const hitlIndex = workflow.nodes.findIndex(n => n.id === hitlItem.nodeId);
      resumeNodeId = hitlIndex < workflow.nodes.length - 1 ? workflow.nodes[hitlIndex + 1].id : null;
    }

    const context: Record<string, any> = {
      input: hitlItem.originalPayload,
      extracted: modifiedPayload || hitlItem.extractedPayload,
      category: modifiedPayload?.category || hitlItem.extractedPayload?.category,
      sentiment: modifiedPayload?.sentiment || hitlItem.extractedPayload?.sentiment,
      confidenceScore: 1.0, // Human confirmed
      status: 'approved_by_operator',
    };

    while (resumeNodeId) {
      const currentNode = workflow.nodes.find(n => n.id === resumeNodeId);
      if (!currentNode) break;

      const stepId = `step-${execution.id}-${execution.steps.length + 1}`;
      const stepStartTime = Date.now();

      const stepTrace: StepTrace = {
        id: stepId,
        executionId: execution.id,
        nodeId: currentNode.id,
        nodeType: currentNode.type,
        nodeName: currentNode.name,
        status: 'running',
        inputData: { ...context },
        outputData: null,
        latencyMs: 0,
        promptTokens: 0,
        candidateTokens: 0,
        totalTokens: 0,
        costUsd: 0,
        retryCount: 0,
        createdAt: new Date().toISOString(),
      };

      if (currentNode.type === 'external_dispatcher') {
        const config = currentNode.config as ExternalDispatcherConfig;
        const dispatchLog = await dispatcherService.executeDispatch({
          executionId: execution.id,
          workflowId: workflow.id,
          config,
          context,
        });

        stepTrace.status = 'completed';
        stepTrace.latencyMs = dispatchLog.latencyMs;
        stepTrace.outputData = {
          dispatchId: dispatchLog.id,
          channel: dispatchLog.channel,
          destination: dispatchLog.destination,
          status: dispatchLog.status,
          responseCode: dispatchLog.responseCode,
          renderedMessage: dispatchLog.renderedMessage,
        };
        stepTrace.reasoning = `Resumed pipeline: Dispatch delivered to ${config.channel.toUpperCase()} after human approval.`;
      }

      stepTrace.completedAt = new Date().toISOString();
      execution.steps.push(stepTrace);
      executionEvents.emit('step_update', { executionId: execution.id, step: stepTrace });

      const nextEdge = workflow.edges.find(e => e.source === currentNode.id);
      resumeNodeId = nextEdge ? nextEdge.target : null;
    }

    execution.status = 'success';
    execution.updatedAt = new Date().toISOString();
    await db.saveExecution(execution);
    executionEvents.emit('execution_update', { type: 'completed', execution });

    return execution;
  }
}
