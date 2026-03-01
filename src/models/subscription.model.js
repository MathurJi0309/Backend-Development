import mongoose, { Schema } from "mongoose";

const subscriptionSchema = new Schema({
    subscriber: { type: Schema.Types.ObjectId, ref: "User", required: true }, //one who subscribe to the channel
    channel: { type: Schema.Types.ObjectId, ref: "User", required: true }, //one who is being subscribed to
}, { timestamps: true });

const Subscription = mongoose.model("Subscription", subscriptionSchema);

export default Subscription;