import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface MindMapNode {
  id: string
  text: string
  children: string[] // Array of child node IDs
  parent: string | null // Parent node ID or null for root
  collapsed?: boolean // Whether the node is collapsed in the bullet view
}

export const useMindMapStore = defineStore('mindmap', () => {
  // State
  const nodes = ref<Record<string, MindMapNode>>({})
  const rootNodeId = ref<string | null>(null)
  const selectedNodeId = ref<string | null>(null)

  // Getters
  const rootNode = computed(() => (rootNodeId.value ? nodes.value[rootNodeId.value] : null))
  
  const allNodes = computed(() => Object.values(nodes.value))
  
  const getNodeById = (id: string) => nodes.value[id]
  
  const getChildNodes = (nodeId: string) => {
    const node = nodes.value[nodeId]
    if (!node) return []
    return node.children.map(childId => nodes.value[childId])
  }

  // Actions
  function createNode(text: string = '', parentId: string | null = null): string {
    const id = generateId()
    
    const newNode: MindMapNode = {
      id,
      text,
      children: [],
      parent: parentId,
      collapsed: false
    }
    
    nodes.value[id] = newNode
    
    // If this is the first node, set it as root
    if (Object.keys(nodes.value).length === 1) {
      rootNodeId.value = id
    }
    
    // If it has a parent, add it to the parent's children
    if (parentId && nodes.value[parentId]) {
      nodes.value[parentId].children.push(id)
    }
    
    return id
  }
  
  function updateNodeText(id: string, text: string) {
    if (nodes.value[id]) {
      nodes.value[id].text = text
    }
  }
  
  function deleteNode(id: string) {
    const node = nodes.value[id]
    if (!node) return
    
    // Remove from parent's children
    if (node.parent && nodes.value[node.parent]) {
      const parentNode = nodes.value[node.parent]
      parentNode.children = parentNode.children.filter(childId => childId !== id)
    }
    
    // Handle children - either delete them or reassign to parent
    node.children.forEach(childId => {
      if (node.parent) {
        // Move children to the parent
        nodes.value[childId].parent = node.parent
        nodes.value[node.parent].children.push(childId)
      } else {
        // Delete children if no parent to reassign to
        deleteNode(childId)
      }
    })
    
    // If this was the root node, set a new root if possible
    if (rootNodeId.value === id) {
      const remainingNodes = Object.keys(nodes.value).filter(nodeId => nodeId !== id)
      rootNodeId.value = remainingNodes.length > 0 ? remainingNodes[0] : null
    }
    
    // Delete the node
    delete nodes.value[id]
    
    // Update selected node if needed
    if (selectedNodeId.value === id) {
      selectedNodeId.value = null
    }
  }
  
  function moveNode(id: string, newParentId: string | null) {
    const node = nodes.value[id]
    if (!node) return
    
    // Check for circular reference
    if (newParentId && wouldCreateCycle(id, newParentId)) {
      console.error('Cannot move node: would create a cycle')
      return
    }
    
    // Remove from current parent's children
    if (node.parent && nodes.value[node.parent]) {
      const parentNode = nodes.value[node.parent]
      parentNode.children = parentNode.children.filter(childId => childId !== id)
    }
    
    // Update node's parent
    node.parent = newParentId
    
    // Add to new parent's children
    if (newParentId && nodes.value[newParentId]) {
      nodes.value[newParentId].children.push(id)
    }
  }
  
  function toggleCollapsed(id: string) {
    if (nodes.value[id]) {
      nodes.value[id].collapsed = !nodes.value[id].collapsed
    }
  }
  
  function selectNode(id: string | null) {
    selectedNodeId.value = id
  }
  
  // Helper function to check if moving a node would create a cycle
  function wouldCreateCycle(nodeId: string, targetParentId: string): boolean {
    // If we're trying to make a node its own parent, that's a cycle
    if (nodeId === targetParentId) return true
    
    // Check if the target parent is a descendant of the node
    return isDescendantOf(targetParentId, nodeId)
  }
  
  // Helper function to check if a node is a descendant of another node
  function isDescendantOf(nodeId: string, ancestorId: string): boolean {
    let currentId = nodeId
    while (currentId) {
      const currentNode = nodes.value[currentId]
      if (!currentNode || !currentNode.parent) break
      if (currentNode.parent === ancestorId) return true
      currentId = currentNode.parent
    }
    
    return false
  }
  
  // Helper function to generate a unique ID
  function generateId(): string {
    return Math.random().toString(36).substring(2, 10)
  }
  
  // Freemind XML format export/import
  function exportToFreemind(): string {
    if (!rootNodeId.value) return '<map version="1.0.1"></map>'
    
    const xml = ['<map version="1.0.1">']
    
    function addNodeToXml(nodeId: string, indent: number) {
      const node = nodes.value[nodeId]
      if (!node) return
      
      const indentation = ' '.repeat(indent)
      const escapedText = escapeXml(node.text)
      
      if (node.children.length === 0) {
        xml.push(`${indentation}<node ID="${node.id}" TEXT="${escapedText}"/>`)
      } else {
        xml.push(`${indentation}<node ID="${node.id}" TEXT="${escapedText}">`)
        node.children.forEach(childId => addNodeToXml(childId, indent + 2))
        xml.push(`${indentation}</node>`)
      }
    }
    
    if (rootNodeId.value) {
      addNodeToXml(rootNodeId.value, 2)
    }
    
    xml.push('</map>')
    return xml.join('\n')
  }
  
  function importFromFreemind(xmlString: string) {
    // Reset current state
    nodes.value = {}
    rootNodeId.value = null
    selectedNodeId.value = null
    
    try {
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(xmlString, 'text/xml')
      
      const rootNodeElement = xmlDoc.querySelector('map > node')
      if (!rootNodeElement) {
        // Create a default empty root node if none exists
        createNode('Central Idea')
        return
      }
      
      function processNode(element: Element, parentId: string | null = null): string {
        const id = element.getAttribute('ID') || generateId()
        const text = element.getAttribute('TEXT') || ''
        
        // Create the node
        const nodeId = createNode(text, parentId)
        
        // Override the generated ID with the one from the XML if it exists
        if (element.getAttribute('ID')) {
          nodes.value[nodeId].id = id
          // Update the nodes object with the correct ID
          if (nodeId !== id) {
            nodes.value[id] = nodes.value[nodeId]
            delete nodes.value[nodeId]
            
            // If this node has a parent, update the parent's children array
            if (parentId && nodes.value[parentId]) {
              const parentNode = nodes.value[parentId]
              const index = parentNode.children.indexOf(nodeId)
              if (index !== -1) {
                parentNode.children[index] = id
              }
            }
          }
        }
        
        // Process child nodes
        const childElements = element.querySelectorAll(':scope > node')
        childElements.forEach(childElement => {
          processNode(childElement as Element, id)
        })
        
        return id
      }
      
      const rootId = processNode(rootNodeElement)
      rootNodeId.value = rootId
    } catch (error) {
      console.error('Error importing Freemind XML:', error)
      // Create a default empty root node on error
      createNode('Central Idea')
    }
  }
  
  // Helper function to escape XML special characters
  function escapeXml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }
  
  // Initialize with a default root node
  function initializeDefaultMindMap() {
    if (Object.keys(nodes.value).length === 0) {
      createNode('Central Idea')
    }
  }
  
  // Call initialization
  initializeDefaultMindMap()
  
  return {
    nodes,
    rootNodeId,
    selectedNodeId,
    rootNode,
    allNodes,
    getNodeById,
    getChildNodes,
    createNode,
    updateNodeText,
    deleteNode,
    moveNode,
    toggleCollapsed,
    selectNode,
    exportToFreemind,
    importFromFreemind,
    isDescendantOf
  }
})