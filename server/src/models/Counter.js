import mongoose from 'mongoose';

// Atomic sequence for human-readable listing numbers (DS-1001, DS-1002, ...).
const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } });
export const Counter = mongoose.model('Counter', counterSchema);

const START = 1000;
export async function nextSeq(name) {
  // $inc on a missing document creates it with seq = 1, so the offset is added here.
  const c = await Counter.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return START + c.seq;
}
