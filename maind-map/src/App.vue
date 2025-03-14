<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useMindMapStore } from '@/stores/mindmap'
import { nextTick } from 'vue'

const route = useRoute()
const mindMapStore = useMindMapStore()
const showSaveDialog = ref(false)
const aiQuestion = ref('')
const aiResponse = ref('')
const isLoading = ref(false)
const aiError = ref('')

// Determine which instructions to show based on current route
const currentView = computed(() => {
  return route.path.includes('mindmap') ? 'mindmap' : 'bullet'
})

// Function to save the mindmap to Freemind XML format
function saveMap() {
  const xmlContent = mindMapStore.exportToFreemind()
  
  // Create a blob and download link
  const blob = new Blob([xmlContent], { type: 'text/xml' })
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = 'mindmap.mm'
  document.body.appendChild(a)
  a.click()
  
  // Clean up
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 0)
}

// Function to load from Freemind XML format
function loadMap(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return
  
  const file = input.files[0]
  const reader = new FileReader()
  
  reader.onload = (e) => {
    if (!e.target || typeof e.target.result !== 'string') return
    
    mindMapStore.importFromFreemind(e.target.result)
    
    // Reset node positions (this will be handled by the MindmapView component)
  }
  
  reader.readAsText(file)
  
  // Reset the input so the same file can be selected again
  input.value = ''
}

// Function to create a new map
function createNewMap() {
  // Check if the current map has nodes other than the root
  const hasContent = mindMapStore.allNodes.length > 1 ||
                    (mindMapStore.rootNode && mindMapStore.rootNode.text !== 'Central Idea');
  
  if (hasContent) {
    // Show save dialog if there's content
    showSaveDialog.value = true;
  } else {
    // If no content, just create a new map
    resetMap();
  }
}

// Function to reset the map
function resetMap() {
  // Clear all nodes
  mindMapStore.nodes = {};
  mindMapStore.rootNodeId = null;
  mindMapStore.selectedNodeId = null;
  
  // Create a new root node
  const rootId = mindMapStore.createNode('Central Idea');
  mindMapStore.rootNodeId = rootId;
  
  // Hide dialog if it was shown
  showSaveDialog.value = false;
}

// Function to save and then reset
function saveAndReset() {
  saveMap();
  resetMap();
}

// Function to send the question to Claude AI via local API server
async function sendToClaudeAI() {
  if (!aiQuestion.value.trim()) {
    aiError.value = 'Please enter a question';
    return;
  }
  
  try {
    isLoading.value = true;
    aiError.value = '';
    aiResponse.value = 'Sending request to Claude AI...';
    
    // Get the current mindmap as Freemind XML
    const freemindXML = mindMapStore.exportToFreemind();
    
    // Prepare the request data
    const requestData = {
      question: aiQuestion.value,
      freemind_xml: freemindXML
    };
    
    // Send the request to the local API server
    const response = await fetch('http://localhost:5001/api/claude', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });
    
    // Process the response
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const responseData = await response.json();
    
    if (responseData.success) {
      // Process the successful response
      processClaudeResponse(responseData.response);
      
      // Store the original question for reference
      const originalQuestion = aiQuestion.value;
      
      // Clear the question field for the next question
      aiQuestion.value = '';
    } else {
      throw new Error(responseData.error || 'Unknown API error');
    }
    
    // Reset loading state
    isLoading.value = false;
  } catch (error) {
    console.error('Error sending request to Claude API:', error);
    aiError.value = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    isLoading.value = false;
    aiResponse.value = 'Failed to get a response from Claude AI. Please try again.';
  }
}

// Function to process Claude's response
function processClaudeResponse(responseText: string) {
  aiResponse.value = responseText;
  
  // Check if the response contains Freemind XML
  const xmlMatch = responseText.match(/<map version="[^"]*">([\s\S]*?)<\/map>/);
  
  if (xmlMatch) {
    try {
      // Extract the XML
      const xmlContent = `<map version="1.0.1">${xmlMatch[1]}</map>`;
      
      // Import the XML to update the mindmap
      mindMapStore.importFromFreemind(xmlContent);
      
      // Show success message
      aiResponse.value = 'Mind map updated successfully with Claude\'s response.';
      
      // Clear the question field for the next question
      aiQuestion.value = '';
    } catch (error) {
      console.error('Error processing XML from Claude:', error);
      aiError.value = 'Error processing the mind map from Claude\'s response.';
    }
  } else {
    // If no XML was found, just display the response
    aiQuestion.value = '';
  }
}
</script>

<template>
  <div class="app-container">
    <aside class="sidebar">
      <h1 class="app-title">MaindMap</h1>
      
      <div class="sidebar-menu">
        <h3>Actions</h3>
        <button
          class="menu-button"
          @click="createNewMap"
        >
          New Map
        </button>
        
        <button
          class="menu-button"
          @click="saveMap"
        >
          Save
        </button>
        
        <label
          class="menu-button import-button"
        >
          Load
          <input
            type="file"
            accept=".mm"
            @change="loadMap"
            style="display: none"
          >
        </label>
      </div>
      
      <!-- AI Interaction Section -->
      <div class="ai-interaction">
        <h3>AI Interaction</h3>
        <div class="ai-input-container">
          <textarea
            v-model="aiQuestion"
            class="ai-input"
            placeholder="Ask a question about your mind map..."
            rows="3"
            :disabled="isLoading"
          ></textarea>
          <button
            class="ai-submit-button"
            @click="sendToClaudeAI()"
            :disabled="isLoading"
          >
            Send to AI
          </button>
        </div>
        
        <!-- AI Response Display -->
        <div v-if="aiResponse || aiError" class="ai-response-container">
          <div v-if="aiError" class="ai-error">{{ aiError }}</div>
          <div v-if="aiResponse" class="ai-response">{{ aiResponse }}</div>
        </div>
      </div>
      
      <!-- Save Dialog -->
      <div v-if="showSaveDialog" class="save-dialog">
        <div class="save-dialog-content">
          <p>Do you want to save the current map?</p>
          <div class="save-dialog-buttons">
            <button @click="saveAndReset" class="dialog-button save-button">Save</button>
            <button @click="resetMap" class="dialog-button delete-button">Delete</button>
            <button @click="showSaveDialog = false" class="dialog-button cancel-button">Cancel</button>
          </div>
        </div>
      </div>
      
      <!-- Instructions section in sidebar -->
      <div class="instructions">
        <h3>Instructions:</h3>
        
        <!-- Bullet View Instructions -->
        <div v-if="currentView === 'bullet'">
          <h4>Keyboard Shortcuts:</h4>
          <ul>
            <li><strong>Enter</strong>: Create a new bullet at the same level</li>
            <li><strong>Tab</strong>: Indent (make child of previous bullet)</li>
            <li><strong>Shift+Tab</strong>: Unindent (move up one level)</li>
            <li><strong>Delete</strong> on empty bullet: Remove the bullet</li>
          </ul>
        </div>
        
        <!-- Mind Map View Instructions -->
        <div v-if="currentView === 'mindmap'">
          <ul>
            <li><strong>Drag nodes</strong> to reposition them</li>
            <li><strong>Drag a node onto another</strong> to make it a child</li>
            <li><strong>Double-click</strong> to edit node text</li>
            <li>Use the <strong>+ button</strong> to add child nodes</li>
            <li>Use the <strong>× button</strong> to delete nodes</li>
          </ul>
        </div>
      </div>
    </aside>

    <div class="main-content">
      <header class="tabs-header">
        <nav class="tabs-nav">
          <RouterLink to="/bullet" class="tab">Bullet View</RouterLink>
          <RouterLink to="/mindmap" class="tab">Mind Map</RouterLink>
        </nav>
      </header>
      
      <main>
        <RouterView />
      </main>
      
      <footer>
        <p>MaindMap - A Vue.js Mind Mapping Application</p>
      </footer>
    </div>
  </div>
</template>

<style>
/* Global styles */
:root {
  --primary-color: #4CAF50;
  --secondary-color: #2196F3;
  --text-color: #333;
  --background-color: #f8f8f8;
  --border-color: #ddd;
  --sidebar-width: 437.5px; /* Increased by 75% from 250px */
}

body {
  font-family: 'Arial', sans-serif;
  margin: 0;
  padding: 0;
  color: var(--text-color);
  background-color: var(--background-color);
  height: 100vh;
  overflow: hidden;
}

/* App container */
.app-container {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* Sidebar */
.sidebar {
  width: var(--sidebar-width);
  background-color: white;
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.app-title {
  margin: 0 0 1.5rem 0;
  color: var(--primary-color);
  font-size: 1.8rem;
  text-align: center;
}

/* Menu buttons */
.sidebar .menu-button,
.sidebar .import-button {
  display: block;
  width: 100%;
  padding: 0.75rem 1rem;
  background-color: white;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-color);
  font-size: 0.9rem;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s ease;
  margin-bottom: 0.5rem;
  outline: none;
  box-sizing: border-box;
  font-family: 'Arial', sans-serif;
  font-weight: normal;
  text-decoration: none;
}

.sidebar .menu-button:hover,
.sidebar .import-button:hover {
  background-color: rgba(0, 0, 0, 0.03);
}

/* Navigation */
.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 2rem;
}

.nav-link {
  padding: 0.75rem 1rem;
  text-decoration: none;
  color: var(--text-color);
  border-radius: 4px;
  transition: background-color 0.2s;
  text-align: center;
}

.nav-link:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.nav-link.router-link-active {
  background-color: var(--primary-color);
  color: white;
}

/* Tabs */
.tabs-header {
  background-color: white;
  border-bottom: 1px solid var(--border-color);
}

.tabs-nav {
  display: flex;
  padding: 0 1rem;
}

.tab {
  padding: 1rem 2rem;
  font-size: 1.1rem;
  text-decoration: none;
  color: var(--text-color);
  border-bottom: 3px solid transparent;
  transition: all 0.2s ease;
}

.tab:hover {
  background-color: rgba(0, 0, 0, 0.03);
}

.tab.router-link-active {
  color: var(--primary-color);
  border-bottom: 3px solid var(--primary-color);
  font-weight: bold;
  background-color: rgba(76, 175, 80, 0.1); /* Light green background */
}

/* Instructions */
.instructions {
  background-color: #f5f5f5;
  border-radius: 5px;
  padding: 1rem;
  margin-top: auto;
  margin-bottom: 1rem;
}

.instructions h3 {
  margin-top: 0;
  margin-bottom: 0.75rem;
}

.instructions h4 {
  margin-top: 0;
  margin-bottom: 0.5rem;
}

.instructions ul {
  padding-left: 1.25rem;
  margin-top: 0.5rem;
}

.instructions li {
  margin-bottom: 0.5rem;
}

/* Main content area */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Main content */
main {
  flex: 1;
  padding: 1.5rem;
  overflow: auto;
}

/* Footer */
footer {
  padding: 0.75rem;
  text-align: center;
  background-color: white;
  border-top: 1px solid var(--border-color);
}

/* Save Dialog */
.save-dialog {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.save-dialog-content {
  background-color: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  max-width: 400px;
  width: 90%;
  text-align: center;
}

.save-dialog-content p {
  margin-top: 0;
  margin-bottom: 1.5rem;
  font-size: 1.1rem;
}

.save-dialog-buttons {
  display: flex;
  justify-content: center;
  gap: 1rem;
}

.dialog-button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: bold;
  transition: background-color 0.2s;
}

.save-button {
  background-color: var(--primary-color);
  color: white;
}

.save-button:hover {
  background-color: #3d8b40;
}

.delete-button {
  background-color: #f44336;
  color: white;
}

.delete-button:hover {
  background-color: #d32f2f;
}

.cancel-button {
  background-color: #9e9e9e;
  color: white;
}

.cancel-button:hover {
  background-color: #757575;
}

/* AI Interaction Styles */
.ai-interaction {
  margin-top: 1.5rem;
  margin-bottom: 1.5rem;
  background-color: #f0f7ff;
  border-radius: 5px;
  padding: 1rem;
  border: 1px solid var(--secondary-color);
}

.ai-interaction h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: var(--secondary-color);
}

.ai-input-container {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.ai-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-family: 'Arial', sans-serif;
  font-size: 0.9rem;
  resize: vertical;
}

.ai-submit-button {
  padding: 0.75rem 1rem;
  background-color: var(--secondary-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.ai-submit-button:hover:not(:disabled) {
  background-color: #0b7dda;
}

.ai-submit-button:disabled {
  background-color: #9e9e9e;
  cursor: not-allowed;
}

.ai-response-container {
  margin-top: 1rem;
  padding: 0.75rem;
  background-color: white;
  border-radius: 4px;
  border: 1px solid #ddd;
  max-height: 200px;
  overflow-y: auto;
}

.ai-error {
  color: #f44336;
  font-weight: bold;
}

.ai-response {
  white-space: pre-wrap;
  font-size: 0.9rem;
}
</style>
