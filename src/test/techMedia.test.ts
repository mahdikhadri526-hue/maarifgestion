import { beforeEach, expect, it, vi } from "vitest";
const { upload } = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { storage: { from: () => ({ upload }) } } }));
import { storeTechMedia, uploadTechVideo, VIDEO_PREFIX } from "@/lib/techMedia";

beforeEach(() => { upload.mockReset(); upload.mockResolvedValue({ error: null }); });

it("stores legacy video separately while preserving adjacent photos and references", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ blob: async () => new Blob(["video"], { type: "video/mp4" }) }));
  const result = await storeTechMedia(["data:image/jpeg;base64,photo", "data:video/mp4;base64,dmlkZW8=", VIDEO_PREFIX + "existing.mp4"]);
  expect(result[0]).toBe("data:image/jpeg;base64,photo");
  expect(result[1].startsWith(VIDEO_PREFIX)).toBe(true);
  expect(result[2]).toBe(VIDEO_PREFIX + "existing.mp4");
  expect(upload).toHaveBeenCalledOnce();
  vi.unstubAllGlobals();
});

it("does not produce a database reference if video upload fails", async () => {
  upload.mockResolvedValue({ error: new Error("upload failed") });
  await expect(uploadTechVideo(new File(["video"], "test.mp4", { type: "video/mp4" }))).rejects.toThrow("upload failed");
});

it("leaves stored videos and photos unchanged without uploading them again", async () => {
  const media = [VIDEO_PREFIX + "saved.mp4", "data:image/jpeg;base64,photo"];
  expect(await storeTechMedia(media)).toEqual(media);
  expect(upload).not.toHaveBeenCalled();
});