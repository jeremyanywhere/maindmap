import os

def read_api_key():
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
        print(f"Error reading API key: {e}")
        return None

if __name__ == "__main__":
    api_key = read_api_key()
    if api_key:
        print("Successfully read API key from .private file")
    else:
        print("Failed to read API key from .private file")