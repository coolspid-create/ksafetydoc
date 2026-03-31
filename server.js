import express from "express";
import multer from "multer";
import { OpenAI } from "openai";
import { parse, extractFormFields, compare, markdownToHwpx, blocksToMarkdown } from "kordoc";
import fs from "fs";
import path from "path";
import cors from "cors";
import 'dotenv/config';
import JSZip from "jszip";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 추출된 이미지 저장 디렉토리
const IMAGES_DIR = path.join(__dirname, 'extracted_images');
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// AI 정량화 및 정제 함수 (o1-preview + 절대적 복사기 모드)
// ⚠️ 이 함수는 이제 사용자가 명시적으로 "AI 정제" 옵션을 켤 때만 호출됩니다.
// 청킹 과정에서 구조가 깨지는 문제가 있어 기본은 OFF 입니다.
async function refineWithGPT4o(markdown) {
  // 스마트 청킹: 4000자 내외로 끊되, 줄바꿈 기준으로 절단 (이전 2000자에서 확대)
  const chunkSize = 4000;
  const chunks = [];
  let currentPos = 0;

  while (currentPos < markdown.length) {
    let endPos = currentPos + chunkSize;
    if (endPos < markdown.length) {
      // 표(table) 중간에 끊기지 않도록, 빈 줄(\n\n) 기준으로 절단
      const lastDoubleNewline = markdown.lastIndexOf("\n\n", endPos);
      if (lastDoubleNewline > currentPos) {
        endPos = lastDoubleNewline;
      } else {
        const lastNewline = markdown.lastIndexOf("\n", endPos);
        if (lastNewline > currentPos) endPos = lastNewline;
      }
    }
    chunks.push(markdown.substring(currentPos, endPos));
    currentPos = endPos;
  }

  let combinedResult = "";
  let previousContext = "";

  for (let i = 0; i < chunks.length; i++) {
    console.log(`[AI] 섹션 [${i + 1}/${chunks.length}] 처리 중 (o1-preview)...`);
    
    const contextPrompt = previousContext ? `\n\n[이전 조각의 마지막 500자 문맥]:\n${previousContext}\n\n[진단 안내]: 당신은 위 내용 바로 다음을 처리하고 있습니다. 순서가 끊기지 않게 연결하십시오.\n` : "";

    try {
      const response = await openai.chat.completions.create({
        model: "o1-preview",
        max_completion_tokens: 10000, 
        messages: [
          {
            role: "user",
            content: `당신은 문서의 순서를 1mm도 틀리지 않는 '절대적 법령 텍스트 복사기'입니다. 당신의 지능을 발휘하여 아래의 [새로운 조각]을 정제하되, 다음의 [복사기 절대 규칙]을 따르세요.

[복사기 절대 규칙]
1. [지문 누락 0%]: 원문 텍스트에 있는 모든 조문(제N조), 모든 항(1.), 모든 호, 부칙, 별표 등을 단 한 글자도 빠뜨리지 말고 입력된 순서 "그대로" 출력하십시오.
2. [순서 일체성]: 원문의 순서를 절대 변경하거나 건너뛰지 마십시오.
3. [구조적 정제]: 불필요한 강조 기호(**, ##)는 삭제하되, 표(Table) 문법은 반드시 줄바꿈(Enter)을 포함하여 유지하십시오.
4. [문맥 앵커]: [이전 조각의 마지막 문맥]이 주어집니다. 이를 확인하여 연결하십시오.

${contextPrompt}
[새로운 조각]: 
${chunks[i]}

오직 정제된 본문 텍스트(또는 표)만 응답하십시오.`
          }
        ],
      });

      const refinedPart = response.choices[0].message.content.trim();
      combinedResult += refinedPart + "\n\n";
      previousContext = refinedPart.substring(Math.max(0, refinedPart.length - 500));
    } catch (error) {
      console.error(`[AI Error] Chunk ${i} failed:`, error);
      combinedResult += chunks[i] + "\n\n"; 
    }
  }

  return combinedResult.trim();
}

// ✅ 결정론적 마크다운 후처리 (AI 의존 없이 구조를 정규화)
// 핵심: 한국 법령 문서의 "항(①②③)" 마커가 번호 리스트를 끊도록 처리
function normalizeMarkdown(markdown) {
  let lines = markdown.split('\n');
  let result = [];
  let inTable = false;

  // 원문자 ①~⑳ 패턴 (항 마커)
  const circledNumbers = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';
  const circledNumberRegex = new RegExp(`^[${circledNumbers}]`);
  // 괄호 숫자 (1), (2) 등도 항 마커로 사용되는 경우
  const parenNumberRegex = /^\(\d+\)\s/;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmed = line.trim();

    // 1. 표(table) 구간 감지 - 표 앞뒤로 반드시 빈 줄 보장
    const isTableLine = trimmed.startsWith('|');
    if (isTableLine && !inTable) {
      if (result.length > 0 && result[result.length - 1].trim() !== '') {
        result.push('');
      }
      inTable = true;
    } else if (!isTableLine && inTable) {
      if (result.length > 0 && result[result.length - 1].trim() !== '') {
        result.push('');
      }
      inTable = false;
    }

    // 2. 조문 제목(제N조) 앞에 빈 줄 추가하여 시각적 구분
    const isArticle = /^제\s*\d/.test(trimmed);
    if (isArticle && result.length > 0 && result[result.length - 1].trim() !== '') {
      result.push('');
    }

    // 3. ★ 핵심 수정: 원문자(①②③...) 항 마커 앞에 빈 줄 삽입
    //    → 이전 번호 리스트(1. 2. 3.)를 확실히 끊어줌
    if (circledNumberRegex.test(trimmed) && result.length > 0 && result[result.length - 1].trim() !== '') {
      result.push('');
    }

    // 4. 괄호 숫자 (1), (2) 등이 항 마커로 사용될 때도 빈 줄 삽입
    //    단, 이미 리스트 아이템(1. 2. 3.) 내부가 아닌 경우에만
    if (parenNumberRegex.test(trimmed) && result.length > 0 && result[result.length - 1].trim() !== '') {
      result.push('');
    }

    // 5. 부칙 앞 빈 줄
    if (/^부\s*칙/.test(trimmed) && result.length > 0 && result[result.length - 1].trim() !== '') {
      result.push('');
    }

    // 6. [별표], [별지] 앞 빈 줄
    if (/^\[별(표|지)/.test(trimmed) && result.length > 0 && result[result.length - 1].trim() !== '') {
      result.push('');
    }

    // 7. ## 마크다운 헤딩 앞에 빈 줄 삽입 (렌더링 보장)
    if (/^#{1,6}\s/.test(trimmed) && result.length > 0 && result[result.length - 1].trim() !== '') {
      result.push('');
    }

    // 8. <br> 태그를 실제 줄바꿈으로 변환 (kordoc이 표 안에서 <br> 사용)
    if (!isTableLine) {
      line = line.replace(/<br\s*\/?>/gi, '  \n');
    }

    result.push(line);
  }

  // 9. 연속 빈 줄 3개 이상은 2개로 축소
  let output = result.join('\n');
  output = output.replace(/\n{4,}/g, '\n\n\n');

  // 10. '■ ... [별표 N]' 또는 '■ ... [별지 N]' 라인을 헤딩으로 변환 (## 없이 시작할 때)
  output = output.replace(/^(■\s+.+\[별(표|지)\s*[^\]]*\].*)/gm, '## $1');
  // 이미 ## 가 중복된 경우 정리 (## ## → ##)
  output = output.replace(/^(#{2,})\s+(#{2,})\s+/gm, '$1 ');

  return output.trim();
}

// ✅ IRBlock 테이블 → HTML <table> 변환 (논리적 열 정규화)
// HWP 내부의 미세 그리드(45열 등)를 논리적 열로 정규화하여 filler 셀 제거
function blocksToHtmlTables(blocks) {
  if (!blocks || !Array.isArray(blocks)) return [];
  
  const htmlTables = [];
  
  for (const block of blocks) {
    if (block.type !== 'table' || !block.table) continue;
    
    const table = block.table;
    const cellRows = table.cells;
    
    if (!cellRows || cellRows.length === 0) continue;
    
    const numRows = cellRows.length;
    const numCols = table.cols || 0;
    
    if (numRows === 0 || numCols === 0) continue;
    
    // ── Step 1: 유의미한 셀의 시작 열 위치(논리적 열 경계) 수집 ──
    const occupied = Array.from({ length: numRows }, () => Array(numCols).fill(false));
    const logicalColSet = new Set();
    
    for (let r = 0; r < numRows; r++) {
      const row = cellRows[r];
      if (!row) continue;
      for (let c = 0; c < numCols && c < row.length; c++) {
        if (occupied[r][c]) continue;
        const cell = row[c];
        if (!cell) continue;
        const cs = cell.colSpan ?? 1;
        const rs = cell.rowSpan ?? 1;
        // 유의미한 셀: 텍스트가 있거나, 수직 병합(rowSpan>1)이 있는 셀만
        // 빈 셀의 수평 병합(colSpan>1)은 폼 입력란이므로 열 경계 생성 불필요
        const isSignificant = (cell.text && cell.text.trim() !== '') || rs > 1;
        if (isSignificant) {
          logicalColSet.add(c);
        }
        // 점유 표시
        for (let dr = 0; dr < rs && (r + dr) < numRows; dr++) {
          for (let dc = 0; dc < cs && (c + dc) < numCols; dc++) {
            occupied[r + dr][c + dc] = true;
          }
        }
      }
    }
    
    // 논리적 열 경계를 정렬된 배열로 변환
    const logicalCols = [...logicalColSet].sort((a, b) => a - b);
    const numLogicalCols = logicalCols.length;
    
    if (numLogicalCols === 0) continue;
    
    // 원본 열 인덱스 → 논리적 열 인덱스 매핑
    // colToLogical[c] = 해당 원본 열이 몇 번째 논리적 열에 해당하는지
    const colToLogical = new Map();
    for (let i = 0; i < logicalCols.length; i++) {
      colToLogical.set(logicalCols[i], i);
    }
    
    // ── Step 2: 정규화된 테이블 렌더링 ──
    const occupied2 = Array.from({ length: numRows }, () => Array(numLogicalCols).fill(false));
    
    let html = '<div style="overflow-x:auto;margin:1.5rem 0;border-radius:0.5rem;border:1px solid #cbd5e1;">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:0.875rem;table-layout:auto;">\n';
    
    for (let r = 0; r < numRows; r++) {
      const row = cellRows[r];
      if (!row) continue;
      
      let hasContent = false;
      const rowHtml = [];
      
      for (let li = 0; li < numLogicalCols; li++) {
        if (occupied2[r][li]) continue;
        
        // 이 논리적 열에 대응하는 원본 열 인덱스
        const origCol = logicalCols[li];
        const cell = row[origCol];
        if (!cell) continue;
        
        const origCs = cell.colSpan ?? 1;
        const rs = cell.rowSpan ?? 1;
        const text = (cell.text ?? '').replace(/\n/g, '<br/>');
        
        // 원본 colspan을 논리적 colspan으로 변환
        // origCol부터 origCol+origCs 범위에 포함되는 논리적 열 수를 셈
        let logicalCs = 0;
        for (let j = li; j < numLogicalCols; j++) {
          if (logicalCols[j] < origCol + origCs) {
            logicalCs++;
          } else {
            break;
          }
        }
        logicalCs = Math.max(1, logicalCs);
        
        // 점유 맵 업데이트
        for (let dr = 0; dr < rs && (r + dr) < numRows; dr++) {
          for (let dc = 0; dc < logicalCs && (li + dc) < numLogicalCols; dc++) {
            occupied2[r + dr][li + dc] = true;
          }
        }
        
        if (text.trim() !== '' || logicalCs > 1 || rs > 1) hasContent = true;
        
        const isHeader = cell.isHeader || (table.hasHeader && r === 0);
        const tag = isHeader ? 'th' : 'td';
        const bgStyle = isHeader ? 'background:#f1f5f9;font-weight:600;color:#334155;' : '';
        const attrs = [];
        if (logicalCs > 1) attrs.push(`colspan="${logicalCs}"`);
        if (rs > 1) attrs.push(`rowspan="${rs}"`);
        attrs.push(`style="border:1px solid #cbd5e1;padding:0.5rem 0.65rem;text-align:left;vertical-align:middle;line-height:1.5;white-space:pre-wrap;${bgStyle}"`);
        
        rowHtml.push(`    <${tag} ${attrs.join(' ')}>${text}</${tag}>`);
      }
      
      // 완전히 빈 행은 건너뛰기
      if (rowHtml.length > 0) {
        html += '  <tr>\n' + rowHtml.join('\n') + '\n  </tr>\n';
      }
    }
    
    html += '</table>';
    html += '</div>';
    htmlTables.push(html);
  }
  
  return htmlTables;
}

// 마크다운 안의 표를 HTML 테이블로 대체
function replaceMarkdownTablesWithHtml(markdown, htmlTables) {
  if (!htmlTables || htmlTables.length === 0) return markdown;
  
  // 마크다운 표 패턴: | 로 시작하는 연속된 줄들
  const tableRegex = /((?:^\|.+\|\s*$\n?)+)/gm;
  let tableIndex = 0;
  
  const result = markdown.replace(tableRegex, (match) => {
    if (tableIndex < htmlTables.length) {
      const html = htmlTables[tableIndex];
      tableIndex++;
      return '\n' + html + '\n';
    }
    return match; // HTML 테이블이 부족하면 원본 유지
  });
  
  return result;
}

function markdownToJSON(markdown) {
  const lines = markdown.split('\n');
  const document = { chapters: [] };
  
  let currentChapter = null;
  let currentArticle = null;
  let defaultChapter = { title: "일반(General)", articles: [] };
  let currentArray = defaultChapter.articles;

  for (let line of lines) {
    const rawLine = line;
    line = line.trim();
    if (!line) continue;

    const chapterMatch = line.match(/^제\s*(\d+)\s*장\s+(.+)/);
    if (chapterMatch) {
      currentChapter = { number: parseInt(chapterMatch[1], 10), title: chapterMatch[2].trim(), articles: [] };
      document.chapters.push(currentChapter);
      currentArticle = null;
      currentArray = currentChapter.articles;
      continue;
    }

    const articleMatch = line.match(/^제\s*(\d+(?:의\d+)?)\s*조\s*(?:\(([^)]+)\))?\s*(.*)/);
    if (articleMatch) {
      if (!currentChapter && document.chapters.length === 0) document.chapters.push(defaultChapter);
      currentArticle = { number: articleMatch[1], title: articleMatch[2] ? articleMatch[2].trim() : "", content: [] };
      if (articleMatch[3] && articleMatch[3].trim()) currentArticle.content.push(articleMatch[3].trim());
      currentArray.push(currentArticle);
      continue;
    }

    if (line.match(/^(부\s*칙|\[별표|\[별지)/)) {
      currentChapter = { title: line, articles: [] };
      document.chapters.push(currentChapter);
      currentArticle = null;
      currentArray = currentChapter.articles;
      continue;
    }

    if (currentArticle) {
      currentArticle.content.push(rawLine);
    } else {
      if (!currentChapter && document.chapters.length === 0) document.chapters.push(defaultChapter);
      if (currentArray.length === 0) {
        currentArticle = { number: "0", title: "서문", content: [] };
        currentArray.push(currentArticle);
      }
      currentArticle.content.push(rawLine);
    }
  }

  if (defaultChapter.articles.length === 0) {
    document.chapters = document.chapters.filter(c => c !== defaultChapter);
  }

  return document;
}

function jsonToXML(jsonObj) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<document>\n';
  if (jsonObj.chapters) {
    jsonObj.chapters.forEach(chapter => {
      xml += `  <chapter${chapter.number ? ` number="${chapter.number}"` : ''}>\n`;
      xml += `    <title><![CDATA[${chapter.title || ''}]]></title>\n`;
      if (chapter.articles) {
        chapter.articles.forEach(article => {
          xml += `    <article number="${article.number || ''}">\n`;
          xml += `      <title><![CDATA[${article.title || ''}]]></title>\n`;
          xml += `      <content>\n`;
          if (article.content) {
            article.content.forEach(line => {
              xml += `        <line><![CDATA[${line}]]></line>\n`;
            });
          }
          xml += `      </content>\n`;
          xml += `    </article>\n`;
        });
      }
      xml += `  </chapter>\n`;
    });
  }
  xml += '</document>';
  return xml;
}

// ✅ HWPX/HWP 파일에서 이미지 추출
async function extractImagesFromFile(fileBuffer, filename) {
  const images = [];
  const ext = path.extname(filename).toLowerCase();
  
  // 세션별 고유 ID
  const sessionId = Date.now().toString(36);
  const sessionDir = path.join(IMAGES_DIR, sessionId);
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
  
  if (ext === '.hwpx') {
    try {
      const zip = await JSZip.loadAsync(fileBuffer);
      
      // BinData 폴더에서 이미지 파일 추출
      const imageEntries = [];
      zip.forEach((relativePath, entry) => {
        if (entry.dir) return;
        const lower = relativePath.toLowerCase();
        if (lower.includes('bindata') || lower.includes('media') || lower.includes('image')) {
          const ext2 = path.extname(lower);
          if (['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.emf', '.wmf'].includes(ext2)) {
            imageEntries.push({ path: relativePath, entry });
          }
        }
      });
      
      console.log(`[Images] HWPX에서 ${imageEntries.length}개 이미지 발견`);
      
      for (let i = 0; i < imageEntries.length; i++) {
        const { path: imgPath, entry } = imageEntries[i];
        const data = await entry.async('nodebuffer');
        const ext2 = path.extname(imgPath).toLowerCase();
        const safeName = `img_${i}${ext2}`;
        const outputPath = path.join(sessionDir, safeName);
        fs.writeFileSync(outputPath, data);
        
        const mimeTypes = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.bmp': 'image/bmp' };
        images.push({
          index: i,
          originalPath: imgPath,
          filename: safeName,
          url: `/api/images/${sessionId}/${safeName}`,
          mimeType: mimeTypes[ext2] || 'image/png',
          size: data.length
        });
      }
    } catch (e) {
      console.error('[Images] HWPX 이미지 추출 실패:', e.message);
    }
  }
  
  return { sessionId, images };
}

// ✅ OpenAI Vision API로 이미지 설명 생성
async function describeImageWithVision(imagePath, mimeType) {
  try {
    const imageData = fs.readFileSync(imagePath);
    const base64 = imageData.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: '이 이미지의 내용을 한국어로 간결하게 설명해주세요. 로고, 도장, 서명, 다이어그램, 차트 등 이미지의 종류와 핵심 내용을 포함해주세요.' },
          { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } }
        ]
      }],
      max_tokens: 300
    });
    
    return response.choices[0]?.message?.content || '이미지 설명 없음';
  } catch (e) {
    console.error('[Vision] 이미지 분석 실패:', e.message);
    return `이미지 분석 실패: ${e.message}`;
  }
}

// 이미지 서빙 엔드포인트
app.get('/api/images/:sessionId/:filename', (req, res) => {
  const filePath = path.join(IMAGES_DIR, req.params.sessionId, req.params.filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Image not found' });
  }
});

app.post("/api/convert", upload.single("file"), async (req, res) => {
  req.setTimeout(600000); 
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "파일 없음" });
    const originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    
    // 고급 변환 옵션 처리
    const parseOptions = {};
    if (req.body.pages) {
      parseOptions.pages = req.body.pages; // e.g., "1-3"
    }
    if (req.body.useOcr === 'true') {
      // Mock OCR 연동 (Vision API 등으로 확장 가능)
      parseOptions.ocr = async (pageImage, pageNumber, mimeType) => {
        console.log(`[OCR Mock] Page ${pageNumber} OCR processing...`);
        return "[OCR 기반 텍스트 추출됨]";
      };
    }

    const result = await parse(req.file.buffer.buffer, parseOptions);
    if (result.success) {
      let formFields = null;
      let formConfidence = null;
      if (result.blocks) {
        const formResult = extractFormFields(result.blocks);
        formFields = formResult.fields;
        formConfidence = formResult.confidence;
      }

      fs.writeFileSync("kordoc_debug_raw.md", result.markdown, "utf8");
      
      // 블록 데이터에서 HTML 테이블 생성 (셀 병합 보존)
      const htmlTables = blocksToHtmlTables(result.blocks);
      
      // 테이블 블록 디버그 정보 저장
      if (result.blocks) {
        const tableBlocks = result.blocks.filter(b => b.type === 'table');
        fs.writeFileSync("kordoc_debug_tables.json", JSON.stringify(tableBlocks, null, 2), "utf8");
        console.log(`[Tables] ${tableBlocks.length}개 테이블 감지, ${htmlTables.length}개 HTML 변환 완료`);
      }
      
      // ✅ 이미지 추출
      const { sessionId, images } = await extractImagesFromFile(req.file.buffer, originalname);
      
      // Vision API로 이미지 분석 (useAi 옵션이 켜져 있을 때만)
      if (req.body.useAi === 'true' && images.length > 0) {
        console.log(`[Vision] ${images.length}개 이미지 AI 분석 시작...`);
        for (const img of images) {
          const imgPath = path.join(IMAGES_DIR, sessionId, img.filename);
          if (['.png', '.jpg', '.jpeg', '.gif'].includes(path.extname(img.filename).toLowerCase())) {
            img.description = await describeImageWithVision(imgPath, img.mimeType);
            console.log(`[Vision] ${img.filename}: ${img.description.substring(0, 50)}...`);
          }
        }
      }
      
      let finalMarkdown;
      
      // AI 정제는 사용자가 명시적으로 요청할 때만 실행
      if (req.body.useAi === 'true') {
        console.log('[Pipeline] AI 정제 모드 활성화됨');
        const refinedMarkdown = await refineWithGPT4o(result.markdown);
        finalMarkdown = normalizeMarkdown(refinedMarkdown);
      } else {
        console.log('[Pipeline] 원본 파서 출력 + 정규화 모드');
        finalMarkdown = normalizeMarkdown(result.markdown);
      }
      
      // 마크다운 표를 HTML 테이블로 대체 (셀 병합 보존)
      finalMarkdown = replaceMarkdownTablesWithHtml(finalMarkdown, htmlTables);
      
      // 추출된 이미지를 마크다운에 삽입
      if (images.length > 0) {
        let imageSection = '\n\n---\n\n## 📎 추출된 이미지\n\n';
        for (const img of images) {
          imageSection += `<div style="margin:1rem 0;padding:1rem;border:1px solid #e2e8f0;border-radius:0.5rem;background:#f8fafc;">`;
          imageSection += `<img src="${img.url}" alt="${img.originalPath}" style="max-width:100%;height:auto;border-radius:0.25rem;" />`;
          if (img.description) {
            imageSection += `<p style="margin:0.5rem 0 0;font-size:0.85rem;color:#475569;">🔍 ${img.description}</p>`;
          }
          imageSection += `<p style="margin:0.25rem 0 0;font-size:0.75rem;color:#94a3b8;">${img.originalPath} (${(img.size / 1024).toFixed(1)}KB)</p>`;
          imageSection += `</div>\n`;
        }
        finalMarkdown += imageSection;
      }
      
      fs.writeFileSync("kordoc_debug_final.md", finalMarkdown, "utf8");

      const parsedJson = markdownToJSON(finalMarkdown);
      const parsedXml = jsonToXML(parsedJson);

      res.json({
        success: true,
        markdown: finalMarkdown,
        json: parsedJson,
        xml: parsedXml,
        filename: originalname,
        formFields: formFields,
        formConfidence: formConfidence,
        images: images,
        imageSessionId: sessionId
      });
    } else {
      res.status(500).json({ success: false, error: "HWP 파싱 실패" });
    }
  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/compare", upload.array("files", 2), async (req, res) => {
  try {
    if (!req.files || req.files.length !== 2) {
      return res.status(400).json({ success: false, error: "비교할 두 개의 파일을 함께 업로드하세요." });
    }
    // multer.array('files') sends files in order
    const oldFile = req.files[0];
    const newFile = req.files[1];
    
    const diff = await compare(oldFile.buffer.buffer, newFile.buffer.buffer);
    res.json({ success: true, diff });
  } catch (error) {
    console.error("Compare API Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/export/hwpx", async (req, res) => {
  try {
    const { markdown } = req.body;
    if (!markdown) {
      return res.status(400).json({ success: false, error: "마크다운 콘텐츠가 비어 있습니다." });
    }
    const hwpxBuffer = await markdownToHwpx(markdown);
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="export.hwpx"');
    res.send(Buffer.from(hwpxBuffer));
  } catch (error) {
    console.error("HWPX Export Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
