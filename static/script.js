const fileInput = document.getElementById("fileInput");
const dropArea = document.getElementById("dropArea");
const analyzeBtn = document.getElementById("analyzeBtn");

let selectedFile = null;


// FILE SELECTION

fileInput.addEventListener("change", function () {

    if (this.files.length > 0) {
        selectedFile = this.files[0];

        document.getElementById("fileName").textContent =
            "Selected: " + selectedFile.name;
    }

});


// DRAG AND DROP

dropArea.addEventListener("dragover", function (e) {
    e.preventDefault();
    dropArea.classList.add("dragover");
});

dropArea.addEventListener("dragleave", function () {
    dropArea.classList.remove("dragover");
});

dropArea.addEventListener("drop", function (e) {

    e.preventDefault();

    dropArea.classList.remove("dragover");

    const file = e.dataTransfer.files[0];

    if (file) {
        selectedFile = file;

        fileInput.value = "";

        document.getElementById("fileName").textContent =
            "Selected: " + file.name;
    }

});


// HTML ESCAPING

function escapeHTML(text) {

    return text.replace(/[&<>"']/g, function (char) {

        return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        }[char];

    });

}


// ANALYZE DOCUMENT

analyzeBtn.addEventListener("click", async function () {

    if (!selectedFile) {
        alert("Please upload a document first.");
        return;
    }

    analyzeBtn.disabled = true;
    analyzeBtn.textContent = "Analyzing...";

    const formData = new FormData();

    formData.append("file", selectedFile);

    try {

        const response = await fetch("/analyze", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Analysis failed.");
        }

        showResults(data);

    }

    catch (error) {

        alert(error.message);

    }

    finally {

        analyzeBtn.disabled = false;
        analyzeBtn.textContent = "✦ Analyze Document";

    }

});


// DISPLAY RESULTS

function showResults(data) {

    const errors = data.errors;

    document.getElementById("totalErrors").textContent =
        errors.length;

    document.getElementById("grammarErrors").textContent =
        errors.filter(e => e.type === "grammar").length;

    document.getElementById("spellingErrors").textContent =
        errors.filter(e => e.type === "spelling").length;

    const score = Math.max(0, 100 - errors.length * 5);

    document.getElementById("qualityScore").textContent =
        score + "%";


    // HIGHLIGHT ERRORS

    const text = data.text;

    let html = "";
    let lastIndex = 0;

    const sortedErrors = [...errors].sort(
        (a, b) => a.offset - b.offset
    );

    sortedErrors.forEach(error => {

        const start = error.offset;
        const end = start + error.length;

        if (start < lastIndex || end > text.length || error.length <= 0) {
            return;
        }

        html += escapeHTML(text.slice(lastIndex, start));

        html += `<mark title="${escapeHTML(error.message)}">`;

        html += escapeHTML(text.slice(start, end));

        html += "</mark>";

        lastIndex = end;

    });

    html += escapeHTML(text.slice(lastIndex));

    document.getElementById("documentPreview").innerHTML = html;


    // DISPLAY SUGGESTIONS

    const errorList = document.getElementById("errorList");

    if (errors.length === 0) {

        errorList.textContent = "Excellent! No grammar or spelling errors were detected.";

        return;

    }

    errorList.innerHTML = "";

    errors.forEach((error, index) => {

        const card = document.createElement("div");

        card.className = "error-item";

        const title = document.createElement("div");
        title.className = "error-number";
        title.textContent = `Error ${index + 1} — ${error.type}`;

        const message = document.createElement("p");
        message.textContent = error.message;

        const incorrect = document.createElement("p");
        incorrect.textContent = "Incorrect: " + error.context;

        const suggestion = document.createElement("p");
        suggestion.className = "correction";

        suggestion.textContent =
            "Suggested correction: " +
            (error.suggestions.join(", ") || "No suggestion available");

        const location = document.createElement("p");
        location.textContent =
            "Character position: " + error.offset;

        card.append(title, message, incorrect, suggestion, location);

        errorList.appendChild(card);

    });

}