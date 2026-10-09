import { computed, ref, type Ref } from "vue";
import { nodeTools, z } from "./nodeTools";
import type { NodeOutputs } from "./values";

export function useNodeGeneration(outputs: Readonly<Ref<NodeOutputs>>, cancel: () => void) {
  const status = ref<"idle" | "running" | "succeeded" | "failed">("idle");
  const error = ref("");
  const generating = computed(() => status.value === "running");
  const getStatus = () => ({ status: status.value, outputs: outputs.value, ...(error.value ? { error: error.value } : {}) });

  nodeTools.register({
    name: "getGenerationStatus",
    description: "Query generation status (idle/running/succeeded/failed) since the node was opened, current outputs, and the last generation error. Current outputs may come from a previous generation; idle does not mean no historical outputs, only succeeded means the current generation completed successfully",
    parameters: z.strictObject({}),
    execute: getStatus,
  });
  nodeTools.register({
    name: "cancelGeneration",
    description: "Request to stop current background generation; cancellationRequested indicates a stop request has been sent, then use getGenerationStatus to query termination status. Will not delete existing output, cannot guarantee the provider will cancel the task or charges",
    parameters: z.strictObject({}),
    execute() {
      const cancellationRequested = generating.value;
      if (cancellationRequested) cancel();
      return { ...getStatus(), cancellationRequested };
    },
  });

  async function run<T>(task: () => Promise<T>): Promise<T> {
    if (generating.value) throw new Error("Node is generating, please wait for completion");
    status.value = "running";
    error.value = "";
    try {
      const result = await task();
      status.value = "succeeded";
      return result;
    } catch (failure) {
      status.value = "failed";
      const message = (failure as { response?: { data?: { message?: string } } })?.response?.data?.message;
      error.value = failure instanceof Error && failure.name === "AbortError" ? "Generation cancelled"
        : message || (failure instanceof Error ? failure.message : "Generation failed");
      throw failure;
    }
  }

  return { generating, run };
}
