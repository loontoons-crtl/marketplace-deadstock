import mongoose from 'mongoose';

const localitySchema = new mongoose.Schema(
  {
    city: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
    // Approximate centre of the locality, used for "near" sorting. Optional.
    location: { type: { type: String, enum: ['Point'] }, coordinates: { type: [Number], default: undefined } },
  },
  { timestamps: true }
);

localitySchema.index({ city: 1, name: 1 }, { unique: true });

export const Locality = mongoose.model('Locality', localitySchema);
