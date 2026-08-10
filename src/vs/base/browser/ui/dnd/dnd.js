import { $ } from "../../dom.js";
import "./dnd.css";
function applyDragImage(event, container, label, extraClasses = []) {
  if (!event.dataTransfer) {
    return;
  }
  const dragImage = $(".monaco-drag-image");
  dragImage.textContent = label;
  dragImage.classList.add(...extraClasses);
  const getDragImageContainer = (e) => {
    while (e && !e.classList.contains("monaco-workbench")) {
      e = e.parentElement;
    }
    return e || container.ownerDocument.body;
  };
  const dragContainer = getDragImageContainer(container);
  dragContainer.appendChild(dragImage);
  event.dataTransfer.setDragImage(dragImage, -10, -10);
  setTimeout(() => dragImage.remove(), 0);
}
export {
  applyDragImage
};
