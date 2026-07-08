#!/usr/bin/env python3
"""Phase 4 Vision verification test (runs when API quota is available)."""
import os, sys, time, base64, json, requests, socketio, re

BASE_API = os.environ.get('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta/openai')
API_KEY = os.environ.get('GOOGLE_API_KEY')
BACKEND = 'http://localhost:4001'

def load_api_key():
    global API_KEY
    if API_KEY:
        return API_KEY
    env_path = os.path.join(os.path.dirname(__file__), '..', 'server', '.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
            m = re.search(r'GOOGLE_API_KEY=(.+)', f.read())
            if m:
                os.environ['GOOGLE_API_KEY'] = m.group(1).strip()
    API_KEY = os.environ.get('GOOGLE_API_KEY')
    return API_KEY

def wait_for_quota(timeout=120):
    print('Checking API quota...')
    for i in range(timeout // 10):
        r = requests.post(f'{BASE_API}/chat/completions',
            headers={'Authorization': f'Bearer {API_KEY}', 'Content-Type': 'application/json'},
            json={'model': 'gemini-2.5-flash', 'messages': [{'role': 'user', 'content': 'Hi'}], 'max_tokens': 5},
            timeout=30)
        if r.status_code == 200:
            print(f'Quota available after {i*10}s')
            return True
        print(f'Rate limited ({r.status_code}), waiting...')
        time.sleep(10)
    return False

def upload(path):
    with open(path, 'rb') as f:
        r = requests.post(f'{BACKEND}/api/upload', files={'file': f})
    r.raise_for_status()
    return r.json()

def chat_image(question, attachment, wait=15):
    sio = socketio.Client()
    sio.connect(BACKEND)
    chunks = []
    @sio.on('ai-start')
    def start(): pass
    @sio.on('ai-chunk')
    def chunk(c): chunks.append(c)
    @sio.on('ai-end')
    def end(): pass
    @sio.on('ai-error')
    def err(e): chunks.append(f'[ERROR: {e}]')
    sio.emit('chat-message', {
        'message': question,
        'history': [],
        'attachments': [attachment],
        'conversationId': None
    })
    time.sleep(wait)
    sio.disconnect()
    return ''.join(chunks)

def main():
    load_api_key()
    if not API_KEY:
        print('GOOGLE_API_KEY not set')
        sys.exit(1)
    if not wait_for_quota():
        print('Quota did not become available')
        sys.exit(1)

    tests = [
        ('/tmp/test_ui.png', 'What do you see in this UI screenshot?'),
        ('/tmp/test_browser_error.png', 'What is the error and how do I fix it?'),
        ('/tmp/test_terminal.png', 'Summarize this terminal output.'),
        ('/tmp/test_code.png', 'Explain this code snippet.'),
    ]
    results = {}
    for path, question in tests:
        print(f'\n--- Testing {os.path.basename(path)} ---')
        att = upload(path)
        print('Uploaded:', att.get('filename'))
        resp = chat_image(question, att)
        results[os.path.basename(path)] = resp
        print('Response:', resp[:300])
        time.sleep(2)

    with open('/tmp/phase4_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    print('\nWrote results to /tmp/phase4_results.json')

if __name__ == '__main__':
    main()
