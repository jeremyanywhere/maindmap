import requests
import json
import time

def test_chatgpt_api():
    url = "http://localhost:5001/api/chatgpt"
    
    # Sample data to send
    data = {
        "question": "What is the capital of France?",
        "freemind_xml": "<map version=\"1.0.1\"><node TEXT=\"Countries\"><node TEXT=\"France\"/><node TEXT=\"Germany\"/><node TEXT=\"Italy\"/></node></map>"
    }
    
    print("Sending request to Flask server...")
    print(f"Request data: {json.dumps(data, indent=2)}")
    
    # Send the request
    try:
        # Add a small delay to ensure the server is ready
        time.sleep(1)
        
        # Set a longer timeout for the request
        response = requests.post(url, json=data, timeout=30)
        
        # Print the response status and content
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {response.headers}")
        print("Response Text:")
        print(response.text)
        
        # Try to parse as JSON if possible
        try:
            json_response = response.json()
            print("JSON Response:")
            print(json.dumps(json_response, indent=2))
        except json.JSONDecodeError:
            print("Response is not valid JSON")
        
    except requests.exceptions.Timeout:
        print("Request timed out. The server might be taking too long to respond.")
    except requests.exceptions.ConnectionError:
        print("Connection error. Make sure the Flask server is running.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_chatgpt_api()