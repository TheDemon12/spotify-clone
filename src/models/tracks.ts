import mongoose from 'mongoose';

export interface TrackImage {
	name: String;
	size: Number;
	imageKey: String;
	src?: String;
}
export interface TrackFile {
	name: String;
	trackKey: String;
	size: Number;
}
export interface Track {
	name: String;
	duration: Number;
	images: TrackImage[];
	artists: Array<String>;
	trackFile: TrackFile;
}
interface TrackSchema extends Track, mongoose.Document {}

const trackSchema = new mongoose.Schema({
	name: String,
	duration: Number,
	images: [{ name: String, size: Number, imageKey: String }],
	artists: [String],
	trackFile: { name: String, trackKey: String, size: Number },
});

export const TrackModel = mongoose.model<TrackSchema>(
	'Track',
	trackSchema,
	'tracks'
);
