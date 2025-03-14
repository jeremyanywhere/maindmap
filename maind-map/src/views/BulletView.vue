<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useMindMapStore, type MindMapNode } from '@/stores/mindmap'

const mindMapStore = useMindMapStore()

// Track the currently focused node for editing
const editingNodeId = ref<string | null>(null)
const editingText = ref('')
const editingElement = ref<HTMLElement | null>(null)

// Function to render the bullet tree recursively
function renderBulletTree(nodeId: string | null, level = 0): any[] {
  if (!nodeId || !mindMapStore.getNodeById(nodeId)) return []
  
  const node = mindMapStore.getNodeById(nodeId)
  const isEditing = editingNodeId.value === nodeId
  
  const bulletItem = {
    id: node.id,
    level,
    text: node.text,
    isEditing,
    hasChildren: node.children.length > 0,
    isCollapsed: node.collapsed
  }
  
  const result = [bulletItem]
  
  // If not collapsed, add children
  if (!node.collapsed) {
    node.children.forEach(childId => {
      result.push(...renderBulletTree(childId, level + 1))
    })
  }
  
  return result
}

// Computed property to get the flat list of bullet items
const bulletItems = computed(() => {
  if (!mindMapStore.rootNodeId) return []
  return renderBulletTree(mindMapStore.rootNodeId)
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
    const inputElement = document.querySelector(`.bullet-item[data-node-id="${nodeId}"] input`)
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

// Function to handle key events during editing
function handleKeyDown(event: KeyboardEvent, item: any) {
  console.log('Key pressed:', event.key)  // Debug log
  
  if (!editingNodeId.value) return
  
  const currentNode = mindMapStore.getNodeById(editingNodeId.value)
  if (!currentNode) return
  
  if (event.key === 'Enter') {
    console.log('Enter key pressed')  // Debug log
    event.preventDefault()
    
    const currentNodeId = editingNodeId.value
    
    // Save the current node's text
    mindMapStore.updateNodeText(currentNodeId, editingText.value)
    
    // Check if the current node is the root node
    const isRootNode = currentNodeId === mindMapStore.rootNodeId
    
    let newNodeId: string
    
    if (isRootNode) {
      // For root node, create a child node
      newNodeId = mindMapStore.createNode('', currentNodeId)
      console.log('Created child node for root:', newNodeId)
    } else {
      // For non-root nodes, create a sibling node
      const parentId = currentNode.parent
      newNodeId = mindMapStore.createNode('', parentId)
      
      // If parent exists, reorder children to place new node after current
      if (parentId) {
        const parent = mindMapStore.getNodeById(parentId)
        const currentIndex = parent.children.indexOf(currentNodeId)
        if (currentIndex !== -1) {
          // Remove the new node from the end
          parent.children.pop()
          // Insert it after the current node
          parent.children.splice(currentIndex + 1, 0, newNodeId)
        }
      }
    }
    
    // Clear the current editing state
    editingNodeId.value = null
    
    // Start editing the new node
    nextTick(() => {
      startEditing(newNodeId)
    })
  } else if (event.key === 'Tab') {
    event.preventDefault()
    
    if (event.shiftKey) {
      // Unindent: Move to parent's level
      if (currentNode.parent) {
        const grandparentId = mindMapStore.getNodeById(currentNode.parent).parent
        mindMapStore.moveNode(editingNodeId.value, grandparentId)
      }
    } else {
      // Indent: Make previous sibling the parent
      if (currentNode.parent) {
        const parent = mindMapStore.getNodeById(currentNode.parent)
        const currentIndex = parent.children.indexOf(editingNodeId.value)
        
        if (currentIndex > 0) {
          const previousSiblingId = parent.children[currentIndex - 1]
          mindMapStore.moveNode(editingNodeId.value, previousSiblingId)
        }
      }
    }
  } else if (event.key === 'Escape') {
    editingNodeId.value = null
  } else if (event.key === 'Delete' && editingText.value === '') {
    // Delete node if backspace is pressed on empty text
    event.preventDefault()
    const nodeToDelete = editingNodeId.value
    editingNodeId.value = null
    
    // Find the previous node to focus on
    let nextFocusNodeId = null
    
    if (currentNode.parent) {
      const parent = mindMapStore.getNodeById(currentNode.parent)
      const currentIndex = parent.children.indexOf(nodeToDelete)
      
      if (currentIndex > 0) {
        // Focus on previous sibling
        nextFocusNodeId = parent.children[currentIndex - 1]
      } else {
        // Focus on parent
        nextFocusNodeId = currentNode.parent
      }
    }
    
    mindMapStore.deleteNode(nodeToDelete)
    
    if (nextFocusNodeId) {
      nextTick(() => {
        startEditing(nextFocusNodeId)
      })
    }
  }
}

// Function to toggle node collapse state
function toggleCollapse(nodeId: string) {
  mindMapStore.toggleCollapsed(nodeId)
}

// Initialize with a default node if none exists
onMounted(() => {
  if (!mindMapStore.rootNodeId) {
    const rootId = mindMapStore.createNode('Central Idea')
    mindMapStore.rootNodeId = rootId
  }
})
</script>

<template>
  <div class="bullet-view">
    <div class="bullet-container">
      <div
        v-for="item in bulletItems"
        :key="item.id"
        class="bullet-item"
        :style="{ paddingLeft: `${item.level * 20}px` }"
        :data-node-id="item.id"
      >
        <div class="bullet-content">
          <span
            v-if="item.hasChildren"
            class="collapse-toggle"
            @click="toggleCollapse(item.id)"
          >
            {{ item.isCollapsed ? '▶' : '▼' }}
          </span>
          <span v-else class="bullet-marker">•</span>
          
          <div v-if="item.isEditing" class="edit-container">
            <input
              ref="editingElement"
              v-model="editingText"
              @blur="saveEditing"
              @keydown="(e) => handleKeyDown(e, item)"
              class="edit-input"
              @focus="$event.target.select()"
            />
          </div>
          <div
            v-else
            class="bullet-text"
            @click="startEditing(item.id)"
          >
            {{ item.text || 'Click to edit' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bullet-view {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.bullet-container {
  flex: 1;
  overflow-y: auto;
  margin: 1rem 0;
  font-family: 'Arial', sans-serif;
  padding-right: 1rem;
}

.bullet-item {
  margin: 5px 0;
  display: flex;
  align-items: flex-start;
}

.bullet-content {
  display: flex;
  align-items: center;
  width: 100%;
}

.collapse-toggle {
  cursor: pointer;
  width: 20px;
  display: inline-block;
  text-align: center;
  user-select: none;
}

.bullet-marker {
  width: 20px;
  display: inline-block;
  text-align: center;
}

.bullet-text {
  flex-grow: 1;
  padding: 3px 5px;
  min-height: 24px;
  border-radius: 3px;
  cursor: text;
}

.bullet-text:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.edit-container {
  flex-grow: 1;
}

.edit-input {
  width: 100%;
  padding: 3px 5px;
  border: 1px solid #ccc;
  border-radius: 3px;
  font-family: inherit;
  font-size: inherit;
}
</style>