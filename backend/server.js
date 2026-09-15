const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
);

app.use(cors());
app.use(express.json());


// ================================
// TEST ROUTE
// ================================

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "VJ Quiz Backend is running!"
    });
});


// ================================
// CHECK EMAIL
// ================================

app.post("/api/check-email", async (req, res) => {

    try {

        const { email } = req.body;

        if (!email || typeof email !== "string") {
            return res.status(400).json({
                success: false,
                message: "Email is required."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const { data, error } = await supabase
            .from("quiz_results")
            .select("id")
            .eq("email", normalizedEmail)
            .maybeSingle();

        if (error) {
            console.error("Check email error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to check email."
            });
        }

        if (data) {
            return res.json({
                success: true,
                allowed: false,
                message: "This email has already participated."
            });
        }

        return res.json({
            success: true,
            allowed: true,
            message: "Email is allowed."
        });

    } catch (error) {

        console.error("Unexpected error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error."
        });
    }
});


// ================================
// SUBMIT RESULT
// ================================

app.post("/api/submit", async (req, res) => {

    try {

        const {
            name,
            email,
            score,
            total
        } = req.body;

        // Validate input
        if (
            !name ||
            !email ||
            score === undefined ||
            total === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: "Name, email, score and total are required."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const numericScore = Number(score);
        const numericTotal = Number(total);

        if (
            !Number.isInteger(numericScore) ||
            !Number.isInteger(numericTotal) ||
            numericScore < 0 ||
            numericTotal <= 0 ||
            numericScore > numericTotal
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid score."
            });
        }


        // -------------------------------
        // CHECK EMAIL AGAIN
        // -------------------------------

        const { data: existing, error: checkError } = await supabase
            .from("quiz_results")
            .select("id")
            .eq("email", normalizedEmail)
            .maybeSingle();

        if (checkError) {
            console.error("Duplicate check error:", checkError);

            return res.status(500).json({
                success: false,
                message: "Unable to verify submission."
            });
        }

        if (existing) {
            return res.status(409).json({
                success: false,
                message: "This email has already submitted the quiz."
            });
        }


        // -------------------------------
        // CALCULATE PERCENTAGE
        // -------------------------------

        const percentage = Number(
            ((numericScore / numericTotal) * 100).toFixed(2)
        );


        // -------------------------------
        // SAVE RESULT
        // -------------------------------

        const { data, error } = await supabase
            .from("quiz_results")
            .insert([
                {
                    name: name.trim(),
                    email: normalizedEmail,
                    score: numericScore,
                    total: numericTotal,
                    percentage: percentage
                }
            ])
            .select()
            .single();


        // -------------------------------
        // HANDLE DUPLICATE EMAIL
        // -------------------------------

        if (error) {

            console.error("Insert error:", error);

            // PostgreSQL unique violation
            if (error.code === "23505") {
                return res.status(409).json({
                    success: false,
                    message: "This email has already submitted the quiz."
                });
            }

            return res.status(500).json({
                success: false,
                message: "Failed to save quiz result."
            });
        }


        return res.status(201).json({
            success: true,
            message: "Quiz result saved successfully.",
            result: data
        });

    } catch (error) {

        console.error("Unexpected submit error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error."
        });
    }
});


// ================================
// START SERVER
// ================================

app.listen(PORT, () => {

    console.log("-----------------------------------");
    console.log("VJ Quiz Backend");
    console.log("-----------------------------------");
    console.log(`Server running on http://localhost:${PORT}`);
    console.log("-----------------------------------");

});