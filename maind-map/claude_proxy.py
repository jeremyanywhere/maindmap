from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# Get API key from .private file
def get_api_key_from_file():
    try:
        # Print current working directory
        cwd = os.getcwd()
        print(f"Current working directory: {cwd}")
        
        # List files in current directory
        files = os.listdir('.')
        print(f"Files in current directory: {files}")
        
        # Check if .private exists
        if '.private' in files:
            print(".private file exists in current directory")
        else:
            print(".private file NOT found in current directory")
            
        # Try to open the file
        with open('.private', 'r') as file:
            api_key = file.read().strip()
            # Print first 10 characters of the API key for verification
            print(f"API key from .private file (first 10 chars): {api_key[:10]}...")
            print(f"API key length: {len(api_key)}")
            return api_key
    except Exception as e:
        print(f"Error reading API key from .private file: {e}")
        return os.environ.get('CLAUDE_API_KEY', 'YOUR_API_KEY')

API_KEY = get_api_key_from_file()
print(f"Final API key being used (first 10 chars): {API_KEY[:10]}...")


@app.route('/api/ping', methods=['GET'])
def ping():
    return jsonify({
        'success': True,
        'message': 'Pong!'
    })


@app.route('/api/claude', methods=['POST'])
def proxy_to_claude():
    try:
        # Get the request data from the frontend
        data = request.json
        question = data.get('question', '')
        freemind_xml = data.get('freemind_xml', '')
        
        # Create the message to send to Claude
        message = f"Using the mind map represented by the following Freemind XML, please answer the following question: {question}\n\n{freemind_xml}"
        
        # Prepare the request to Claude API
        claude_url = "https://api.anthropic.com/v1/messages"
        headers = {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
            'anthropic-version': '2023-06-01'
        }
        
        # Print API key for debugging (first 10 chars only)
        print(f"Using API key: {API_KEY[:10]}...")
        
        payload = {
            'model': 'claude-3-opus-20240229',
            'max_tokens': 4000,
            'messages': [
                {
                    'role': 'user',
                    'content': message
                }
            ]
        }
        
        # Print request details for debugging
        print(f"Making request to Claude API with headers: {headers}")
        print(f"Payload: {payload}")
        
        # Make the request to Claude API
        response = requests.post(claude_url, headers=headers, json=payload)
        
        # Print response details for debugging
        print(f"Claude API response status: {response.status_code}")
        print(f"Claude API response headers: {response.headers}")
        print(f"Claude API response text: {response.text[:500]}...")  # Print first 500 chars
        
        # Check if the request was successful
        if response.status_code == 200:
            claude_response = response.json()
            return jsonify({
                'success': True,
                'response': claude_response['content'][0]['text']
            })
        else:
            error_response = {
                'success': False,
                'error': f"API error: {response.status_code}",
                'details': response.text
            }
            print(f"Returning error response: {error_response}")
            return jsonify(error_response), 500
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    print("Starting Claude API proxy server on http://localhost:5001")
    print("Send POST requests to http://localhost:5001/api/claude")
    app.run(debug=True, host='127.0.0.1', port=5001)