const mongoose = require('mongoose');
const bcrypt = require('bcrypt');


const GoogleTokenSchema = new mongoose.Schema({
    access_token: String,
    refresh_token: String,
    scope: String,
    token_type: String,
    expiry_date: Number
}, { _id: false });


const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    google: {
        tokens: GoogleTokenSchema,
        synced: { type: Boolean, default: false }
    }
}, { timestamps: true });


UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});


UserSchema.methods.comparePassword = function (candidate) {
    return bcrypt.compare(candidate, this.password);
};


module.exports = mongoose.model('User', UserSchema);