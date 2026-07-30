// Upload pipeline. Covers the contract migration 023's storage policies enforce:
// per-user path prefix, size/extension caps, and signed (never public) URLs.
import { describe, it, expect, vi, beforeEach } from "vitest";

const upload = vi.fn();
const createSignedUrl = vi.fn();
const getUser = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getUser },
    storage: { from: () => ({ upload, createSignedUrl }) },
  },
}));
vi.mock("@/lib/llm", () => ({ invokeLLM: vi.fn() }));

const { UploadFile, resolveFileUrl, MAX_UPLOAD_BYTES } = await import("@/integrations/Core");

const USER_ID = "11111111-2222-3333-4444-555555555555";

/** A File whose reported size can exceed what we actually allocate. */
function makeFile(name, { type = "application/pdf", size } = {}) {
  const file = new File(["resume"], name, { type });
  if (size != null) Object.defineProperty(file, "size", { value: size });
  return file;
}

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
  upload.mockImplementation((path) => Promise.resolve({ data: { path }, error: null }));
  createSignedUrl.mockResolvedValue({
    data: { signedUrl: "https://project.supabase.co/storage/v1/object/sign/uploads/x?token=t" },
    error: null,
  });
});

describe("UploadFile()", () => {
  it("writes into the caller's own folder — the prefix uploads_insert checks", async () => {
    const res = await UploadFile({ file: makeFile("Jane Doe CV.pdf") });

    expect(upload).toHaveBeenCalledTimes(1);
    const [path] = upload.mock.calls[0];
    expect(path.startsWith(`${USER_ID}/`)).toBe(true);
    expect(res.path).toBe(path);
  });

  it("sanitises the filename so it cannot escape that folder", async () => {
    await UploadFile({ file: makeFile("../../etc/pass wd.pdf") });

    const [path] = upload.mock.calls[0];
    expect(path).not.toContain("..");
    expect(path.split("/")).toHaveLength(2); // exactly <uid>/<file>
  });

  it("returns a signed URL and never a public one", async () => {
    const res = await UploadFile({ file: makeFile("cv.pdf") });

    expect(res.file_url).toContain("/object/sign/");
    expect(res.file_url).not.toContain("/object/public/");
  });

  it("rejects a disallowed extension before touching storage", async () => {
    await expect(
      UploadFile({ file: makeFile("payload.exe", { type: "application/octet-stream" }) })
    ).rejects.toThrow(/isn't supported/);
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects a file over the 20 MB cap before touching storage", async () => {
    await expect(
      UploadFile({ file: makeFile("huge.pdf", { size: MAX_UPLOAD_BYTES + 1 }) })
    ).rejects.toThrow(/the limit is 20 MB/);
    expect(upload).not.toHaveBeenCalled();
  });

  it("refuses to upload without a session — there would be no folder to own", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(UploadFile({ file: makeFile("cv.pdf") })).rejects.toThrow(/signed in/);
    expect(upload).not.toHaveBeenCalled();
  });

  it("does not upsert, so a collision fails loudly instead of overwriting a resume", async () => {
    await UploadFile({ file: makeFile("cv.pdf") });
    expect(upload.mock.calls[0][2]).toMatchObject({ upsert: false });
  });

  it("sends the MIME type the bucket allows, not the browser's guess", async () => {
    // Chrome on Android reports .docx as application/octet-stream, which the
    // bucket's allowed_mime_types refuses — so the extension has to win.
    await UploadFile({
      file: makeFile("cv.docx", { type: "application/octet-stream" }),
    });

    expect(upload.mock.calls[0][2]).toMatchObject({
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
  });

  it("still sends a valid type when the browser reports none at all", async () => {
    await UploadFile({ file: makeFile("notes.txt", { type: "" }) });
    expect(upload.mock.calls[0][2]).toMatchObject({ contentType: "text/plain" });
  });
});

describe("resolveFileUrl()", () => {
  it("signs a bare storage path", async () => {
    const url = await resolveFileUrl(`${USER_ID}/123-cv.pdf`);
    expect(createSignedUrl).toHaveBeenCalledWith(`${USER_ID}/123-cv.pdf`, expect.any(Number));
    expect(url).toContain("/object/sign/");
  });

  it("passes through a URL a recruiter pasted by hand", async () => {
    const external = "https://example.com/cv.pdf";
    expect(await resolveFileUrl(external)).toBe(external);
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("returns null for an empty reference rather than signing nothing", async () => {
    expect(await resolveFileUrl("")).toBeNull();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });
});
