import { z } from "@toonflow/nodes-scaffold/runtime";
import { AnimationClip, AnimationMixer, Euler, LoopOnce, Quaternion, QuaternionKeyframeTrack, VectorKeyframeTrack } from "three";
import { getObjectByThreeJsonId, type SceneRuntime } from "threejson/core";
import { sceneSchema, updateSunShadow } from "./scene";
import { cameraFramesSchema } from "./motion";
import { mannequinJoints } from "./mannequin";

const vector = sceneSchema.shape.objectList.element.shape.position;
export const directorPlanSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  duration: z.number().min(0.2).max(300),
  tracks: z.array(z.strictObject({
    objectId: z.string().trim().min(1).max(100),
    joint: z.enum(mannequinJoints).describe("Mannequin joint animation only; when omitted controls entire object").optional(),
    frames: z.array(z.strictObject({
      time: z.number().min(0).max(300),
      position: vector.optional(),
      rotation: vector.describe("XYZ Euler angles in radians"),
      scale: vector.optional(),
    })).min(2).max(120),
  })).max(200),
  cameraFrames: cameraFramesSchema,
}).superRefine((value, context) => {
  // Last camera holds until end; no need for duplicate end frame. Single frame = static camera.
  if (value.cameraFrames[0]?.time !== 0 || value.cameraFrames.some(frame => frame.time > value.duration)) {
    context.addIssue({ code: "custom", path: ["cameraFrames"], message: "Camera time must start from 0 and not exceed plan duration" });
  }
  const trackIds = new Set<string>();
  let frameCount = 0;
  value.tracks.forEach((track, index) => {
    const key = JSON.stringify([track.objectId, track.joint]);
    if (trackIds.has(key)) {
      context.addIssue({ code: "custom", path: ["tracks", index, "objectId"], message: "Each object or joint can only have one track" });
    }
    trackIds.add(key);
    if (track.joint && track.frames.some(frame => frame.position || frame.scale)) {
      context.addIssue({ code: "custom", path: ["tracks", index, "frames"], message: "Joint animation only uses rotation; position and scale are fixed by skeleton" });
    }
    frameCount += track.frames.length;
    if (track.frames[0]?.time !== 0 || track.frames.some((frame, frameIndex) => frame.time > value.duration || (frameIndex > 0 && frame.time <= track.frames[frameIndex - 1]!.time))) {
      context.addIssue({ code: "custom", path: ["tracks", index, "frames"], message: "Keyframe time must start from 0, strictly increase, and not exceed scene duration" });
    }
  });
  if (frameCount > 2000) context.addIssue({ code: "custom", path: ["tracks"], message: "Scene animation can contain at most 2000 keyframes" });
});
export type DirectorPlan = z.infer<typeof directorPlanSchema>;
export type DirectorPlanItem = DirectorPlan & { id: string; instruction?: string };
export type DirectorGeneration = { id: string; instruction: string; error?: string };

export function prepareSceneAnimation(runtime: SceneRuntime, value: DirectorPlan) {
  const { name, duration, tracks: sourceTracks, cameraFrames } = value;
  const animation = directorPlanSchema.parse({ name, duration, tracks: sourceTracks, cameraFrames });
  const tracks = animation.tracks.flatMap(track => {
    const root = getObjectByThreeJsonId(track.objectId, runtime.scene);
    if (!root) throw new Error(`Animation object not found in scene: ${track.objectId}`);
    if (track.joint && root.userData.objJson?.objType !== "mannequin") throw new Error(`Only mannequin supports joint animation: ${track.objectId}`);
    const object = track.joint ? root.getObjectByName(track.joint) : root;
    if (!object) throw new Error(`Mannequin joint not found in scene: ${track.joint}`);
    const times = track.frames.map(frame => frame.time);
    return [
      new QuaternionKeyframeTrack(`${object.uuid}.quaternion`, times, track.frames.flatMap(frame => new Quaternion().setFromEuler(new Euler(frame.rotation.x, frame.rotation.y, frame.rotation.z)).toArray())),
      ...(["position", "scale"] as const).filter(property => track.frames.some(frame => frame[property])).map(property =>
        new VectorKeyframeTrack(`${object.uuid}.${property}`, times, track.frames.flatMap(frame => {
          const value = frame[property] ?? object[property];
          return [value.x, value.y, value.z];
        })),
      ),
    ];
  });
  const mixer = new AnimationMixer(runtime.scene);
  const clip = new AnimationClip(animation.name, animation.duration, tracks);
  const action = mixer.clipAction(clip).setLoop(LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  return {
    setTime(time: number) {
      if (!Number.isFinite(time)) throw new Error("Invalid scene animation time");
      // LoopOnce auto-pauses at end; resume sampling before seeking to any time.
      action.paused = false;
      mixer.setTime(Math.min(animation.duration, Math.max(0, time)));
      updateSunShadow(runtime);
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(runtime.scene);
    },
  };
}
