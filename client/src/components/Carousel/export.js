import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { EXPORT_SIZE } from './templates/index.jsx';

// Render a DOM node at its native size and capture to canvas.
// The node must already be at EXPORT_SIZE; we do not scale here.
export async function captureNode(node) {
  return html2canvas(node, {
    backgroundColor: '#0a0a0a',
    width: EXPORT_SIZE,
    height: EXPORT_SIZE,
    windowWidth: EXPORT_SIZE,
    windowHeight: EXPORT_SIZE,
    scale: 1,
    useCORS: true,
  });
}

export function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function exportNodeToPng(node, filename) {
  const canvas = await captureNode(node);
  const url = canvas.toDataURL('image/png');
  downloadDataUrl(url, filename);
}

// Given an array of already-rendered DOM nodes (full-size), build a PDF.
export async function exportNodesToPdf(nodes, filename) {
  if (!nodes.length) return;
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: [EXPORT_SIZE, EXPORT_SIZE],
    compress: true,
  });
  for (let i = 0; i < nodes.length; i++) {
    const canvas = await captureNode(nodes[i]);
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    if (i > 0) pdf.addPage([EXPORT_SIZE, EXPORT_SIZE], 'portrait');
    pdf.addImage(imgData, 'JPEG', 0, 0, EXPORT_SIZE, EXPORT_SIZE);
  }
  pdf.save(filename);
}
