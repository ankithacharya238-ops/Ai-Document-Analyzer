from flask import Flask, render_template, request, jsonify
import fitz
import docx
import requests
import os

app = Flask(__name__)

app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024

UPLOAD_FOLDER = "uploads"

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


# HOME PAGE

@app.route("/")
def home():
    return render_template("index.html")


# EXTRACT DOCUMENT TEXT

def extract_text(file_path, extension):

    if extension == ".pdf":

        pdf = fitz.open(file_path)

        text = ""

        for page in pdf:
            text += page.get_text() + "\n"

        pdf.close()

        return text

    elif extension == ".docx":

        document = docx.Document(file_path)

        return "\n".join(
            paragraph.text for paragraph in document.paragraphs
        )

    elif extension == ".txt":

        with open(file_path, "r", encoding="utf-8-sig") as file:
            return file.read()

    return ""


# GRAMMAR CHECKING

def check_grammar(text):

    url = "https://api.languagetool.org/v2/check"

    response = requests.post(
        url,
        data={
            "text": text,
            "language": "en-US"
        },
        timeout=30
    )

    response.raise_for_status()

    result = response.json()

    errors = []

    for match in result.get("matches", []):

        category = match.get("rule", {}).get(
            "category", {}
        ).get("id", "").lower()

        issue = match.get("rule", {}).get(
            "issueType", ""
        ).lower()

        error_type = (
            "spelling"
            if category == "typos" or issue == "misspelling"
            else "grammar"
        )

        suggestions = [
            item["value"]
            for item in match.get("replacements", [])
            if item.get("value")
        ]

        errors.append({

            "message": match.get("message", ""),

            "offset": match.get("offset", 0),

            "length": match.get("length", 0),

            "context": match.get("context", {}).get("text", ""),

            "suggestions": suggestions,

            "type": error_type

        })

    return errors


# ANALYZE DOCUMENT

@app.route("/analyze", methods=["POST"])
def analyze():

    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]

    if not file.filename:
        return jsonify({"error": "Please select a file"}), 400

    extension = os.path.splitext(file.filename)[1].lower()

    if extension not in [".pdf", ".docx", ".txt"]:
        return jsonify({"error": "Unsupported file format"}), 400

    file_path = os.path.join(
        UPLOAD_FOLDER,
        "uploaded_document" + extension
    )

    try:

        file.save(file_path)

        text = extract_text(file_path, extension)

        if not text.strip():
            return jsonify({
                "error": "No readable text found in the document."
            }), 400

        if len(text) > 20000:
            return jsonify({
                "error": "Document is too long for the free grammar API. Please use a document with up to 20,000 characters."
            }), 400

        errors = check_grammar(text)

        return jsonify({

            "text": text,

            "errors": errors,

            "total_errors": len(errors)

        })

    except requests.RequestException:
        return jsonify({
            "error": "Grammar checking service is unavailable. Please try again later."
        }), 503

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:

        if os.path.exists(file_path):
            os.remove(file_path)


# RUN SERVER

if __name__ == "__main__":

    app.run(debug=True)