import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockList = vi.fn();

vi.mock("@/entities/AIRecruiterSettings", () => ({
  AIRecruiterSettings: { list: (...args) => mockList(...args) },
}));

async function loadModule() {
  vi.resetModules();
  return import("@/lib/aiRecruiterSettings");
}

beforeEach(() => {
  mockList.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("aiRecruiterSettings", () => {
  it("resolves parsing tasks to parsing_model", async () => {
    mockList.mockResolvedValue([
      {
        default_model: "deepseek-chat",
        matching_model: "deepseek-chat",
        drafting_model: "deepseek-chat",
        parsing_model: "gpt-4o-mini",
        insights_model: "deepseek-chat",
      },
    ]);
    const { getModelForTask } = await loadModule();
    expect(await getModelForTask("resume_parse")).toBe("gpt-4o-mini");
  });

  it("resolves matching tasks to matching_model", async () => {
    mockList.mockResolvedValue([
      {
        default_model: "deepseek-chat",
        matching_model: "qwen-turbo",
        drafting_model: "deepseek-chat",
        parsing_model: "gpt-4o-mini",
        insights_model: "deepseek-chat",
      },
    ]);
    const { getModelForTask } = await loadModule();
    expect(await getModelForTask("candidate_match")).toBe("qwen-turbo");
  });

  it("resolves insights tasks to insights_model", async () => {
    mockList.mockResolvedValue([
      {
        default_model: "deepseek-chat",
        matching_model: "deepseek-chat",
        drafting_model: "deepseek-chat",
        parsing_model: "gpt-4o-mini",
        insights_model: "claude-3-5-haiku-20241022",
      },
    ]);
    const { getModelForTask } = await loadModule();
    expect(await getModelForTask("pipeline_analysis")).toBe("claude-3-5-haiku-20241022");
  });

  it("falls back to default_model for unknown tasks", async () => {
    mockList.mockResolvedValue([
      {
        default_model: "deepseek-chat",
        matching_model: "qwen-turbo",
        drafting_model: "deepseek-chat",
        parsing_model: "gpt-4o-mini",
        insights_model: "claude-3-5-haiku-20241022",
      },
    ]);
    const { getModelForTask } = await loadModule();
    expect(await getModelForTask("weird_custom_thing")).toBe("deepseek-chat");
  });

  it("uses local-first hardcoded defaults when settings row is empty", async () => {
    mockList.mockResolvedValue([{}]);
    const { getModelForTask } = await loadModule();
    expect(await getModelForTask("parsing")).toBe("local/google/gemma-4-12b-qat");
    expect(await getModelForTask("chat")).toBe("local/google/gemma-4-12b-qat");
  });

  it("returns the runtime OpenAI-compatible config", async () => {
    mockList.mockResolvedValue([
      {
        openai_compatible_base_url: "https://qwen.example.com/v1",
        openai_compatible_model: "qwen2.5-14b-instruct",
      },
    ]);
    const { getOpenAICompatibleConfig } = await loadModule();
    expect(await getOpenAICompatibleConfig()).toEqual({
      baseUrl: "https://qwen.example.com/v1",
      model: "qwen2.5-14b-instruct",
    });
  });
});
