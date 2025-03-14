<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useMindMapStore, type MindMapNode } from '@/stores/mindmap'

const mindMapStore = useMindMapStore()

// State for node editing
const editingNodeId = ref<string | null>(null)
const editingText = ref('')
const editingElement = ref<HTMLElement | null>(null)

// State for drag and drop
const draggedNodeId = ref<string | null>(null)
const dragOverNodeId = ref<string | null>(null)
const dragPosition = ref({ x: 0, y: 0 })
const nodePositions = ref<Record<string, { x: number, y: number }>>({})
const containerRef = ref<HTMLElement | null>(null)
const svgRef = ref<SVGElement | null>(null)
const isDragging = ref(false)
const dragThreshold = 5 // Pixels to move before initiating drag

// State for context menu
const showContextMenu = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const contextMenuNodeId = ref<string | null>(null)
const targetParentId = ref<string | null>(null)

// Computed property to get all nodes for rendering
const nodesForRendering = computed(() => {
  return mindMapStore.allNodes.map(node => {
    return {
      ...node,
      position: nodePositions.value[node.id] || { x: 0, y: 0 },
      isEditing: node.id === editingNodeId.value,
      isDragging: node.id === draggedNodeId.value,
      isDragOver: node.id === dragOverNodeId.value
    }
  })
})

// Computed property to get connections between nodes
const connections = computed(() => {
  const result: { from: string; to: string; fromPos: { x: number; y: number }; toPos: { x: number; y: number } }[] = []
  
  mindMapStore.allNodes.forEach(node => {
    if (node.parent && nodePositions.value[node.id] && nodePositions.value[node.parent]) {
      result.push({
        from: node.parent,
        to: node.id,
        fromPos: nodePositions.value[node.parent],
        toPos: nodePositions.value[node.id]
      })
    }
  })
  
  return result
})

// Function to start editing a node
function startEditing(nodeId: string) {
  const node = mindMapStore.getNodeById(nodeId)
  if (!node) return
  
  editingNodeId.value = nodeId
  editingText.value = node.text
  
  // Focus the input element after the DOM updates
  nextTick(() => {
    // Use querySelector to find the input element within the node
    const inputElement = document.querySelector(`.mindmap-node[data-node-id="${nodeId}"] input`)
    if (inputElement) {
      (inputElement as HTMLInputElement).focus()
    }
  })
}

// Function to save the edited text
function saveEditing() {
  if (editingNodeId.value) {
    mindMapStore.updateNodeText(editingNodeId.value, editingText.value)
    editingNodeId.value = null
  }
}

// Function to create a new node
function createNewNode(parentId: string) {
  const newNodeId = mindMapStore.createNode('New Node', parentId)
  
  // Position the new node near its parent
  if (nodePositions.value[parentId]) {
    const parentPos = nodePositions.value[parentId]
    // Random offset to avoid stacking
    const offsetX = Math.random() * 100 - 50
    const offsetY = Math.random() * 100 - 50
    
    nodePositions.value[newNodeId] = {
      x: parentPos.x + 150 + offsetX,
      y: parentPos.y + offsetY
    }
  }
  
  // Start editing the new node
  nextTick(() => {
    startEditing(newNodeId)
  })
}

// Function to delete a node
function deleteNode(nodeId: string) {
  mindMapStore.deleteNode(nodeId)
  
  // Clean up position data
  if (nodePositions.value[nodeId]) {
    delete nodePositions.value[nodeId]
  }
}

// Function to handle node reparenting (previously done with HTML5 drag and drop)
function reparentNode(sourceNodeId: string, targetNodeId: string) {
  if (!sourceNodeId || sourceNodeId === targetNodeId) {
    // Can't reparent to itself
    return
  }
  
  // Check if this would create a cycle
  const sourceNode = mindMapStore.getNodeById(sourceNodeId)
  const targetNode = mindMapStore.getNodeById(targetNodeId)
  
  if (!sourceNode || !targetNode) {
    return
  }
  
  // Move the node to the new parent
  mindMapStore.moveNode(sourceNodeId, targetNodeId)
}

// Context menu functions
function handleContextMenu(event: MouseEvent, nodeId: string) {
  event.preventDefault()
  
  // Don't show context menu for root node
  if (nodeId === mindMapStore.rootNodeId) return
  
  // Position the context menu
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect()
    contextMenuPosition.value = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    }
  }
  
  contextMenuNodeId.value = nodeId
  showContextMenu.value = true
}

function closeContextMenu() {
  showContextMenu.value = false
  contextMenuNodeId.value = null
  targetParentId.value = null
}

function handleReparent(targetId: string) {
  if (contextMenuNodeId.value) {
    reparentNode(contextMenuNodeId.value, targetId)
  }
  closeContextMenu()
}

// Close context menu when clicking outside
function handleDocumentClick(event: MouseEvent) {
  if (showContextMenu.value) {
    const contextMenuElement = document.querySelector('.context-menu')
    if (contextMenuElement && !contextMenuElement.contains(event.target as Node)) {
      closeContextMenu()
    }
  }
}

// Add document click listener when component is mounted
onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
})

// Function to handle node movement with mouse
function handleNodeMouseDown(event: MouseEvent, nodeId: string) {
  if (event.button !== 0) return // Only handle left mouse button
  
  // Prevent starting drag operation when clicking on buttons
  if ((event.target as HTMLElement).closest('button')) return
  
  const startX = event.clientX
  const startY = event.clientY
  const startPos = { ...nodePositions.value[nodeId] }
  let hasDragStarted = false
  
  function handleMouseMove(moveEvent: MouseEvent) {
    if (!containerRef.value) return
    
    // Prevent default to avoid text selection during drag
    moveEvent.preventDefault()
    
    const dx = moveEvent.clientX - startX
    const dy = moveEvent.clientY - startY
    const distance = Math.sqrt(dx * dx + dy * dy)
    
    // Only start dragging if we've moved past the threshold
    if (!hasDragStarted && distance >= dragThreshold) {
      hasDragStarted = true
      isDragging.value = true
      draggedNodeId.value = nodeId
    }
    
    // Only update position if we're actually dragging
    if (hasDragStarted) {
      // Update node position in real-time for immediate visual feedback
      nodePositions.value[nodeId] = {
        x: startPos.x + dx,
        y: startPos.y + dy
      }
    }
  }
  
  function handleMouseUp() {
    // Clear dragged state
    if (hasDragStarted) {
      isDragging.value = false
      draggedNodeId.value = null
    }
    
    // Remove event listeners
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }
  
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

// Function to handle keyboard events during editing
function handleKeyDown(event: KeyboardEvent) {
  if (!editingNodeId.value) return
  
  if (event.key === 'Enter') {
    event.preventDefault()
    saveEditing()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    editingNodeId.value = null
  }
}

// Function to export the mindmap to Freemind XML format
function exportToFreemind() {
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

// Function to import from Freemind XML format
function importFromFreemind(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return
  
  const file = input.files[0]
  const reader = new FileReader()
  
  reader.onload = (e) => {
    if (!e.target || typeof e.target.result !== 'string') return
    
    mindMapStore.importFromFreemind(e.target.result)
    
    // Reset node positions
    nodePositions.value = {}
    
    // Initialize positions for all nodes
    nextTick(() => {
      initializeNodePositions()
    })
  }
  
  reader.readAsText(file)
  
  // Reset the input so the same file can be selected again
  input.value = ''
}

// Function to initialize node positions
function initializeNodePositions() {
  if (!containerRef.value) return
  
  const centerX = containerRef.value.clientWidth / 2
  const centerY = containerRef.value.clientHeight / 2
  
  // Position the root node at the center
  if (mindMapStore.rootNodeId) {
    nodePositions.value[mindMapStore.rootNodeId] = { x: centerX, y: centerY }
    
    // Position child nodes in a circle around the root
    positionChildrenRadially(mindMapStore.rootNodeId, centerX, centerY, 0, 2 * Math.PI, 150)
  }
}

// Function to position children radially around a parent
function positionChildrenRadially(
  nodeId: string,
  centerX: number,
  centerY: number,
  startAngle: number,
  endAngle: number,
  radius: number,
  level = 1
) {
  const node = mindMapStore.getNodeById(nodeId)
  if (!node || node.children.length === 0) return
  
  const angleStep = (endAngle - startAngle) / node.children.length
  
  node.children.forEach((childId, index) => {
    const angle = startAngle + angleStep * index + angleStep / 2
    const x = centerX + Math.cos(angle) * radius
    const y = centerY + Math.sin(angle) * radius
    
    nodePositions.value[childId] = { x, y }
    
    // Recursively position grandchildren
    const childNode = mindMapStore.getNodeById(childId)
    if (childNode && childNode.children.length > 0) {
      const childStartAngle = angle - angleStep / 2
      const childEndAngle = angle + angleStep / 2
      const childRadius = radius * 0.8 // Decrease radius for each level
      
      positionChildrenRadially(
        childId,
        x,
        y,
        childStartAngle,
        childEndAngle,
        childRadius * (level + 1),
        level + 1
      )
    }
  })
}

// Initialize with a default node if none exists
onMounted(() => {
  if (!mindMapStore.rootNodeId) {
    const rootId = mindMapStore.createNode('Central Idea')
    mindMapStore.rootNodeId = rootId
  }
  
  // Initialize node positions
  nextTick(() => {
    initializeNodePositions()
  })
  
  // Handle window resize
  window.addEventListener('resize', () => {
    if (containerRef.value) {
      initializeNodePositions()
    }
  })
  
  // Add document click listener for context menu
  document.addEventListener('click', handleDocumentClick)
})
</script>

<template>
  <div class="mindmap-view">
    <div class="toolbar">
    </div>
    
    <div
      ref="containerRef"
      class="mindmap-container"
    >
      <!-- SVG for connections -->
      <svg
        ref="svgRef"
        class="connections-svg"
        :width="containerRef?.clientWidth || '100%'"
        :height="containerRef?.clientHeight || '100%'"
      >
        <g>
          <path
            v-for="(conn, index) in connections"
            :key="index"
            :d="`M${conn.fromPos.x},${conn.fromPos.y} C${(conn.fromPos.x + conn.toPos.x) / 2},${conn.fromPos.y} ${(conn.fromPos.x + conn.toPos.x) / 2},${conn.toPos.y} ${conn.toPos.x},${conn.toPos.y}`"
            class="connection-path"
          />
        </g>
      </svg>
      
      <!-- Nodes -->
      <div
        v-for="node in nodesForRendering"
        :key="node.id"
        class="mindmap-node"
        :class="{
          'is-editing': node.isEditing,
          'is-dragging': node.isDragging && isDragging,
          'is-drag-over': node.isDragOver,
          'is-root': node.id === mindMapStore.rootNodeId
        }"
        :style="{
          left: `${node.position.x}px`,
          top: `${node.position.y}px`
        }"
        :data-node-id="node.id"
        @mousedown="handleNodeMouseDown($event, node.id)"
        @contextmenu="handleContextMenu($event, node.id)"
      >
        <div v-if="node.isEditing" class="node-edit-container">
          <input
            ref="editingElement"
            v-model="editingText"
            @blur="saveEditing"
            @keydown="handleKeyDown"
            class="node-edit-input"
            @focus="$event.target.select()"
          />
        </div>
        <div v-else class="node-content" @dblclick="startEditing(node.id)">
          {{ node.text || 'Click to edit' }}
        </div>
        
        <div class="node-actions">
          <button
            class="node-action-button add-button"
            @click="createNewNode(node.id)"
            title="Add child node"
          >
            +
          </button>
          <button
            v-if="node.id !== mindMapStore.rootNodeId"
            class="node-action-button delete-button"
            @click="deleteNode(node.id)"
            title="Delete node"
          >
            ×
          </button>
        </div>
      </div>
      
      <!-- Context Menu for Reparenting -->
      <div
        v-if="showContextMenu"
        class="context-menu"
        :style="{
          left: `${contextMenuPosition.x}px`,
          top: `${contextMenuPosition.y}px`
        }"
      >
        <div class="context-menu-title">Move to parent:</div>
        <div
          v-for="node in nodesForRendering.filter(n => n.id !== contextMenuNodeId && !mindMapStore.isDescendantOf(n.id, contextMenuNodeId))"
          :key="node.id"
          class="context-menu-item"
          @click="handleReparent(node.id)"
        >
          {{ node.text }}
        </div>
        <div class="context-menu-item cancel" @click="closeContextMenu">Cancel</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mindmap-view {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 1rem;
}

.toolbar-button {
  padding: 8px 16px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.toolbar-button:hover {
  background-color: #45a049;
}

.import-button {
  background-color: #2196F3;
}

.import-button:hover {
  background-color: #0b7dda;
}

.mindmap-container {
  flex: 1;
  position: relative;
  overflow: auto;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: #f9f9f9;
}

.connections-svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.connection-path {
  fill: none;
  stroke: #666;
  stroke-width: 2px;
}

.mindmap-node {
  position: absolute;
  background-color: white;
  border: 2px solid #4CAF50;
  border-radius: 10px;
  padding: 10px;
  min-width: 100px;
  max-width: 200px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  cursor: grab;
  user-select: none;
  z-index: 1;
  transform: translate(-50%, -50%);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.mindmap-node.is-root {
  background-color: #e8f5e9;
  border-color: #2e7d32;
}

.mindmap-node.is-dragging {
  opacity: 0.8;
  cursor: grabbing !important;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  z-index: 10;
  transform: translate(-50%, -50%) scale(1.05);
}

.mindmap-node.is-drag-over {
  border-color: #2196F3;
  box-shadow: 0 0 10px rgba(33, 150, 243, 0.5);
}

.node-content {
  text-align: center;
  word-break: break-word;
}

.node-edit-container {
  width: 100%;
}

.node-edit-input {
  width: 100%;
  padding: 5px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-family: inherit;
  font-size: inherit;
}

.node-actions {
  display: flex;
  justify-content: center;
  gap: 5px;
  margin-top: 8px;
}

.node-action-button {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}

.add-button {
  background-color: #4CAF50;
  color: white;
}

.delete-button {
  background-color: #f44336;
  color: white;
}

/* Context Menu Styles */
.context-menu {
  position: absolute;
  background-color: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  padding: 8px 0;
  min-width: 150px;
  z-index: 100;
}

.context-menu-title {
  padding: 8px 16px;
  font-weight: bold;
  color: #555;
  border-bottom: 1px solid #eee;
  margin-bottom: 4px;
}

.context-menu-item {
  padding: 8px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.context-menu-item:hover {
  background-color: #f5f5f5;
}

.context-menu-item.cancel {
  border-top: 1px solid #eee;
  margin-top: 4px;
  color: #f44336;
}
</style>