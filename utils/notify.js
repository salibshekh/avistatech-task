module.exports = {
    notify: async ({ toEmail, subject, body }) => {
        // Simulate async send
        console.log(`\n--- MOCK EMAIL ---\nTo: ${toEmail}\nSubject: ${subject}\n${body}\n--- END MOCK ---\n`);
        return true;
    }
};