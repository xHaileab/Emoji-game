const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    phone_number: { 
        type: String, required: true, unique: true 
    },
    password: { 
        type: String, 
        required: true 
    },
    balance: {
        type: String,
        default: 0
    }
});

module.exports = mongoose.model('User', userSchema);
