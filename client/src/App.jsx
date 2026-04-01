import React, { useState, useRef } from 'react';
import { Upload, FileText, Download, Copy, Check, AlertCircle, Loader2, FileJson, FileType, GitCompare, Settings, Sliders, ChevronDown, ChevronRight, Hash, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';

const App = () => {
  const [appMode, setAppMode] = useState('parse');

  // Parse Mode States
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [viewMode, setViewMode] = useState('markdown');
  const [pages, setPages] = useState('');
  const [useOcr, setUseOcr] = useState(false);
  const [useAi, setUseAi] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Compare Mode States
  const [oldFile, setOldFile] = useState(null);
  const [newFile, setNewFile] = useState(null);
  const [isComparing, setIsComparing] = useState(false);
  const [diffResult, setDiffResult] = useState(null);
  const [compareError, setCompareError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) uploadFile(selectedFile);
  };

  const uploadFile = async (fileToUpload) => {
    setFile(fileToUpload);
    setIsUploading(true);
    setResult(null);
    setError(null);
    const formData = new FormData();
    formData.append('file', fileToUpload);
    if (pages) formData.append('pages', pages);
    if (useOcr) formData.append('useOcr', 'true');
    if (useAi) formData.append('useAi', 'true');

    try {
      const response = await fetch('/api/convert', { method: 'POST', body: formData });
      if (!response.ok) {
         const errData = await response.json();
         throw new Error(errData.error || '서버 오류');
      }
      const data = await response.json();
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || '분석 실패');
      }
    } catch (err) {
      setError(err.message || '서버 접속 실패');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCompare = async () => {
    if (!oldFile || !newFile) {
      setCompareError("A, B 두 문서를 모두 업로드해주세요.");
      return;
    }
    setIsComparing(true);
    setDiffResult(null);
    setCompareError(null);
    const formData = new FormData();
    formData.append('files', oldFile);
    formData.append('files', newFile);

    try {
      const response = await fetch('/api/compare', { method: 'POST', body: formData });
      if (!response.ok) {
         const errData = await response.json();
         throw new Error(errData.error || '비교 실패');
      }
      const data = await response.json();
      if (data.success) {
        setDiffResult(data.diff);
      } else {
        setCompareError(data.error || '분석 실패');
      }
    } catch(err) {
      setCompareError(err.message || '서버 접속 실패');
    } finally {
      setIsComparing(false);
    }
  };

  const handleCopy = () => {
    if (result) {
      let text = '';
      if (viewMode === 'markdown') text = result.markdown;
      if (viewMode === 'json') text = JSON.stringify(result.json, null, 2);
      if (viewMode === 'xml') text = result.xml;
      if (viewMode === 'form') text = JSON.stringify(result.formFields, null, 2);
      navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleDownload = () => {
    if (result) {
      let content = ''; let mimeType = ''; let ext = '';
      if (viewMode === 'markdown') { content = result.markdown; mimeType = 'text/markdown'; ext = 'md'; }
      if (viewMode === 'json') { content = JSON.stringify(result.json, null, 2); mimeType = 'application/json'; ext = 'json'; }
      if (viewMode === 'xml') { content = result.xml; mimeType = 'application/xml'; ext = 'xml'; }
      if (viewMode === 'form') { content = JSON.stringify(result.formFields, null, 2); mimeType = 'application/json'; ext = 'form.json'; }
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${result.filename?.split('.')[0] || 'converted'}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleExportHwpx = async () => {
    if (!result?.markdown) return;
    try {
      const response = await fetch('/api/export/hwpx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown: result.markdown })
      });
      if (!response.ok) throw new Error('HWPX 변환 실패');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${result.filename?.split('.')[0] || 'export'}.hwpx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('HWPX 변환 실패: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen font-sans bg-slate-800" style={{ background: '#f8fafc', color: '#0f172a' }}>
      
      {/* Background Decorators */}
      <div style={{ position: 'fixed', top: '-10%', left: '-10%', width: '50vw', height: '50vh', background: 'rgba(0,160,210,0.05)', filter: 'blur(100px)', borderRadius: '50%', zIndex: 0, pointerEvents: 'none' }}></div>
      <div style={{ position: 'fixed', bottom: '-10%', right: '-10%', width: '50vw', height: '50vh', background: 'rgba(0,56,130,0.05)', filter: 'blur(100px)', borderRadius: '50%', zIndex: 0, pointerEvents: 'none' }}></div>

      <div className="flex flex-col items-center w-full min-h-screen" style={{ padding: '5rem 2.5rem', position: 'relative', zIndex: 10 }}>
        
        {/* HEADER */}
        <header className="w-full max-w-5xl flex justify-between items-center glass shadow-lg p-6" style={{ background: 'rgba(255,255,255,0.7)', borderRadius: '2.5rem', position: 'relative', zIndex: 50, marginBottom: '4rem' }}>
           <div className="flex items-center" style={{ gap: '1.25rem' }}>
              <div className="flex items-center justify-center p-3 rounded-2xl bg-indigo-500 shadow-xl shadow-indigo-500/30" style={{ width: '3.5rem', height: '3.5rem' }}>
                 <FileText className="text-white w-7 h-7" />
              </div>
              <div className="flex flex-col flex-1 shrink-0">
                 <h1 className="text-2xl font-bold tracking-tight text-indigo-500 mb-0 m-0 gradient-text">Ksafety Doc</h1>
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Smart Document Intelligence</p>
              </div>
           </div>
           
           <div className="flex bg-white/60 p-1.5 rounded-2xl border border-indigo-500/10 shadow-sm" style={{ gap: '0.25rem' }}>
              <button 
                onClick={() => setAppMode('parse')}
                className={`py-2 px-5 text-sm font-bold flex items-center gap-2 rounded-xl transition-all ${appMode === 'parse' ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20' : 'text-slate-500 hover:bg-white'}`}
                style={{ border: 'none' }}
              >
                <Settings style={{ width: '1.25rem', height: '1.25rem' }}/> 문서 변환
              </button>
              <button 
                onClick={() => setAppMode('compare')}
                className={`py-2 px-5 text-sm font-bold flex items-center gap-2 rounded-xl transition-all ${appMode === 'compare' ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20' : 'text-slate-500 hover:bg-white'}`}
                style={{ border: 'none' }}
              >
                <GitCompare style={{ width: '1.25rem', height: '1.25rem' }}/> 버전 비교
              </button>
           </div>
        </header>

        {/* PARSE MODE */}
        {appMode === 'parse' && (
           <main className="w-full flex-1" style={{ position: 'relative', zIndex: 10, gap: '2rem', display: 'grid', gridTemplateColumns: '1fr 2.5fr', maxWidth: '1400px', margin: '0 auto', padding: '0 1.5rem' }}>
              {/* Left Form: Uploader */}
              <section className="flex flex-col w-full" style={{ gap: '2rem' }}>
                 
                 {/* Drag and Drop Upload Card */}
                 <div className="glass p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-indigo-500/5 transition-all w-full relative" 
                      style={{ minHeight: '320px', background: 'rgba(255,255,255,0.85)', border: '2px solid rgba(0,160,210,0.1)', borderRadius: '2rem' }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) uploadFile(e.dataTransfer.files[0]); }}
                      onClick={() => { if(!isUploading) document.getElementById('fileInput').click() }}
                 >
                    <input id="fileInput" type="file" className="hidden" onChange={handleFileChange} accept=".hwp,.hwpx,.pdf" />
                    
                    {!file ? (
                      <div className="flex flex-col items-center animate-fade-in">
                         <div className="bg-white p-6 rounded-full mb-8 border border-indigo-500/10 shadow-xl shadow-indigo-500/20 flex items-center justify-center">
                            <Upload className="text-indigo-400" style={{ width: '3rem', height: '3rem' }}/>
                         </div>
                         <h3 className="text-2xl font-bold text-slate-600 mb-3">클릭 또는 파일을 드롭하세요</h3>
                         <p className="text-sm font-medium text-slate-400 px-6">지원 포맷: HWP, HWPX, PDF</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center w-full animate-fade-in relative z-10" style={{ padding: '2rem 1rem' }}>
                         {!isUploading && (
                             <button 
                                onClick={(e) => { e.stopPropagation(); setFile(null); setResult(null); setError(null); }} 
                                className="text-slate-400 hover:text-red-500 p-2 glass rounded-full shadow-sm hover:shadow-md transition-all" 
                                style={{ position: 'absolute', top: '-1.5rem', right: '-1.5rem', background: 'white' }}
                             >
                                <X style={{ width: '1.25rem', height: '1.25rem' }}/>
                             </button>
                         )}
                         
                         {isUploading ? (
                            <div className="flex flex-col items-center gap-6">
                               <Loader2 className="animate-spin text-indigo-500" style={{ width: '3.5rem', height: '3.5rem' }} />
                               <h3 className="text-xl font-bold text-slate-600">스마트 스캐닝 진행 중...</h3>
                               <p className="text-sm font-mono text-indigo-400">구조 및 서식을 실시간 분석합니다</p>
                            </div>
                         ) : (
                            <div className="flex flex-col items-center gap-6">
                               <div className="p-6 bg-green-500/5 rounded-3xl border border-green-500/20">
                                  <FileText className="text-green-500" style={{ width: '4rem', height: '4rem' }} />
                               </div>
                               <h3 className="text-base font-bold text-slate-600 truncate max-w-full" style={{ maxWidth: '280px' }}>{file.name}</h3>
                               <div className="bg-green-500 text-white px-5 py-1.5 rounded-full text-xs font-bold shadow-lg shadow-green-500/20">분석 완료</div>
                            </div>
                         )}
                      </div>
                    )}
                 </div>

                 {/* Advanced Options */}
                 {!result && !isUploading && (
                    <div className="glass overflow-hidden w-full" style={{ borderRadius: '1.5rem', background: 'rgba(255,255,255,0.75)' }}>
                       <button onClick={() => setShowAdvanced(!showAdvanced)} className="w-full flex justify-between items-center p-6 text-sm font-bold text-slate-600 hover:bg-white" style={{ border: 'none' }}>
                          <span className="flex items-center gap-2"><Sliders className="text-indigo-400" style={{ width: '1rem', height: '1rem' }}/> 인식 상세 제어</span>
                          {showAdvanced ? <ChevronDown style={{ width: '1rem', height: '1rem'}}/> : <ChevronRight style={{ width: '1rem', height: '1rem'}}/>}
                       </button>
                       {showAdvanced && (
                          <div className="p-6 bg-white/50 border-t border-indigo-500/10 flex flex-col gap-4">
                             <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold uppercase text-slate-500">페이지 범위 제한</label>
                                <input type="text" value={pages} onChange={e=>setPages(e.target.value)} placeholder="단일페이지(5) 또는 범위(1-5) 입력" className="p-3 bg-white border border-slate-700 rounded-xl text-sm font-mono text-slate-600 outline-none" style={{ borderColor: '#e2e8f0' }} />
                             </div>
                             <label className="flex items-center justify-between cursor-pointer group mt-2 p-3 bg-white rounded-xl border border-slate-700" style={{ borderColor: '#e2e8f0' }}>
                                <span className="text-sm font-bold text-slate-600">문서 복원(OCR AI) 모드 활성화</span>
                                <div className={`flex items-center rounded-full p-1 transition-colors ${useOcr ? 'bg-indigo-500' : 'bg-slate-800'}`} style={{ width: '2.5rem', height: '1.5rem', backgroundColor: useOcr ? '#003882' : '#cbd5e1' }} onClick={()=>setUseOcr(!useOcr)}>
                                   <div className={`bg-white rounded-full shadow-sm transition-transform ${useOcr ? '' : ''}`} style={{ width: '1rem', height: '1rem', transform: useOcr ? 'translateX(1rem)' : 'translateX(0)' }}></div>
                                </div>
                             </label>
                             <label className="flex items-center justify-between cursor-pointer group p-3 bg-white rounded-xl border border-slate-700" style={{ borderColor: '#e2e8f0' }}>
                                <div className="flex flex-col">
                                   <span className="text-sm font-bold text-slate-600">AI 정제 모드 (GPT-5.3-Instant)</span>
                                   <span className="text-xs text-slate-400" style={{ marginTop: '0.25rem' }}>GPT가 텍스트를 재정리합니다. 처리 시간이 길어집니다.</span>
                                </div>
                                <div className={`flex items-center rounded-full p-1 transition-colors ${useAi ? 'bg-indigo-500' : 'bg-slate-800'}`} style={{ width: '2.5rem', height: '1.5rem', backgroundColor: useAi ? '#003882' : '#cbd5e1' }} onClick={()=>setUseAi(!useAi)}>
                                   <div className={`bg-white rounded-full shadow-sm transition-transform`} style={{ width: '1rem', height: '1rem', transform: useAi ? 'translateX(1rem)' : 'translateX(0)' }}></div>
                                </div>
                             </label>
                          </div>
                       )}
                    </div>
                 )}

                  {/* Success Export Options */}
                 {result && !isUploading && (
                   <div className="glass p-10 w-full flex flex-col gap-6 animate-fade-in shadow-2xl bg-white" style={{ background: 'rgba(255,255,255,0.95)', borderRadius: '2.5rem' }}>
                     <h4 className="text-xs font-bold text-slate-500 text-center uppercase tracking-widest mb-2">데이터 추출 결과 저장</h4>
                     <div className="flex flex-col gap-4">
                        <button onClick={handleDownload} className="w-full bg-slate-800 text-white font-bold text-sm py-5 rounded-2xl flex items-center justify-center gap-3 shadow-xl hover:bg-slate-700 transition-all active:scale-[0.98]" style={{ border: 'none', backgroundColor: '#334155' }}>
                           <Download style={{ width: '1.25rem', height: '1.25rem'}}/> 현재 ({viewMode.toUpperCase()}) 다운로드
                        </button>
                        <button onClick={handleExportHwpx} className="w-full bg-indigo-500 text-white font-bold text-sm py-5 rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-indigo-500/30 hover:bg-indigo-600 transition-all active:scale-[0.98]" style={{ border: 'none' }}>
                           <FileType style={{ width: '1.25rem', height: '1.25rem'}}/> HWPX 원본 생성 및 내려받기
                        </button>
                     </div>
                   </div>
                 )}

                 {error && (
                   <div className="p-4 bg-red-500/10 border-red-500/20 text-red-300 font-bold text-sm rounded-2xl border flex items-start gap-2 shadow-sm" style={{ color: '#ef4444' }}>
                      <AlertCircle className="shrink-0 mt-0.5" style={{ width: '1.25rem', height: '1.25rem' }}/> {error}
                   </div>
                 )}
              </section>

              {/* Right Form: The Result Viewer */}
              <section className="glass flex flex-col w-full bg-white shadow-2xl" style={{ minHeight: '650px', height: '80vh', background: 'white', borderRadius: '1.5rem', overflow: 'hidden' }}>
                 {/* Tabs Header */}
                 <div className="bg-slate-50 p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between shadow-sm shrink-0" style={{ background: '#f8fafc' }}>
                    <div className="flex gap-2.5 overflow-x-auto custom-scrollbar no-scrollbar" style={{ paddingRight: '1rem' }}>
                       {['markdown', 'xml', 'json'].map(tab => (
                         <button key={tab} onClick={()=>setViewMode(tab)} className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase transition-all shrink-0 ${viewMode===tab ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-600 hover:bg-white'}`} style={{ border: 'none' }}>
                             {tab}
                         </button>
                       ))}
                    </div>
                    {result && (
                       <button onClick={handleCopy} className="p-3 ml-4 shrink-0 bg-white rounded-2xl hover:bg-slate-50 text-slate-400 hover:text-indigo-500 shadow-md transition-all border border-slate-100" style={{ border: '1px solid #f1f5f9' }}>
                          {copySuccess ? <Check className="text-green-500" style={{ width: '1.5rem', height: '1.5rem' }}/> : <Copy style={{ width: '1.5rem', height: '1.5rem' }}/>}
                       </button>
                    )}
                 </div>
                 
                 {/* Viewer Body */}
                 <div className="flex-1 overflow-y-auto w-full relative custom-scrollbar bg-white" style={{ padding: '0 2rem 2rem 2rem' }}>
                    {result ? (
                       <div className="w-full h-full pt-8 pb-12">
                          <div className={`w-full ${['xml','json'].includes(viewMode) ? 'rounded-2xl overflow-hidden' : 'overflow-visible'}`} style={['xml','json'].includes(viewMode) ? { backgroundColor: '#0f172a' } : {}}>
                             {viewMode === 'markdown' && (
                                <div className="markdown-body p-0 custom-scrollbar line-breaks-preserved text-sm h-full" style={{ padding: '1rem', wordBreak: 'break-word' }}>
                                   {/* Ensure formatting is strictly adhered using original remarks + breaks */}
                                   <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} rehypePlugins={[rehypeRaw]}>{result.markdown}</ReactMarkdown>
                                </div>
                             )}
                             {viewMode === 'xml' && (
                                <pre className="p-8 text-amber-400 font-mono text-sm whitespace-pre-wrap flex-1 m-0 h-full" style={{ color: '#fcd34d' }}><code>{result.xml}</code></pre>
                             )}
                             {viewMode === 'json' && (
                                <pre className="p-8 text-green-500 font-mono text-sm whitespace-pre-wrap flex-1 m-0 h-full" style={{ color: '#4ade80' }}><code>{JSON.stringify(result.json, null, 2)}</code></pre>
                             )}

                          </div>
                       </div>
                    ) : (
                       <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 animate-fade-in text-slate-400">
                          <div className="w-24 h-24 mb-6 rounded-full glass border border-indigo-500/10 flex items-center justify-center shadow-lg bg-white">
                             <FileText className="opacity-30 text-indigo-400" style={{ width: '3rem', height: '3rem'}} />
                          </div>
                          <h3 className="text-lg font-bold text-slate-500 mb-2">프리뷰 패널</h3>
                          <p className="text-sm">좌측에서 문서를 분석하면 여기에 프리뷰가 표시됩니다.</p>
                       </div>
                    )}
                 </div>
              </section>
           </main>
        )}

        {/* COMPARE MODE : Layout specifically fixed to top-to-bottom so elements never overlap and are not stretched horizontally */}
        {appMode === 'compare' && (
           <main className="w-full max-w-5xl flex flex-col flex-1 animate-fade-in" style={{ gap: '3rem', position: 'relative', zIndex: 10 }}>
               
               {/* 1. UPLOADER ROW */}
               <div className="w-full grid md:grid-cols-2" style={{ gap: '1.5rem' }}>
                   {/* Dotted removed, used soft glass shadow for A/B inputs instead. Height limited so button is always shown below.  */}
                   <div className="glass flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-500/5 transition-all text-center relative overflow-hidden"
                        style={{ padding: '2rem', minHeight: '220px', background: 'rgba(255,255,255,0.85)', border: oldFile ? '2px solid rgba(0,160,210,0.5)' : '2px solid rgba(0,160,210,0.1)' }}
                        onClick={() => document.getElementById('oldFile').click()}>
                      <input id="oldFile" type="file" className="hidden" onChange={(e)=>{if(e.target.files[0]) setOldFile(e.target.files[0])}}/>
                      
                      {oldFile && !isComparing ? (
                         <div className="flex flex-col items-center gap-2">
                             <Check className="text-green-500" style={{ width: '2rem', height: '2rem' }}/>
                             <p className="font-bold text-slate-600 text-sm truncate w-full" style={{ maxWidth: '280px' }}>{oldFile.name}</p>
                             <span className="bg-indigo-500/10 px-3 py-1 text-xs text-indigo-500 font-bold rounded-full mt-2">구버전 (Old) 지정됨</span>
                         </div>
                      ) : (
                         <div className="flex flex-col items-center gap-3">
                            <div className="bg-white p-3 rounded-2xl shadow-indigo-500/20 shadow-md border border-indigo-500/10 text-indigo-400 font-bold uppercase tracking-widest text-xs flex flex-col items-center">
                               Source
                               <span className="text-3xl mt-1 leading-none text-indigo-500">A</span>
                            </div>
                            <h3 className="font-bold text-slate-500 text-sm mt-2">비교 기준 구버전 문서</h3>
                         </div>
                      )}
                   </div>

                   <div className="glass flex flex-col items-center justify-center cursor-pointer hover:bg-amber-500/5 transition-all text-center relative overflow-hidden"
                        style={{ padding: '2rem', minHeight: '220px', background: 'rgba(255,255,255,0.85)', border: newFile ? '2px solid rgba(243,115,33,0.5)' : '2px solid rgba(243,115,33,0.1)' }}
                        onClick={() => document.getElementById('newFile').click()}>
                      <input id="newFile" type="file" className="hidden" onChange={(e)=>{if(e.target.files[0]) setNewFile(e.target.files[0])}}/>
                      
                      {newFile && !isComparing ? (
                         <div className="flex flex-col items-center gap-2">
                             <Check className="text-green-500" style={{ width: '2rem', height: '2rem' }}/>
                             <p className="font-bold text-slate-600 text-sm truncate w-full" style={{ maxWidth: '280px' }}>{newFile.name}</p>
                             <span className="bg-amber-500/10 px-3 py-1 text-xs text-amber-500 font-bold rounded-full mt-2" style={{ backgroundColor: 'rgba(241,138,0,0.1)' }}>신버전 (New) 지정됨</span>
                         </div>
                      ) : (
                         <div className="flex flex-col items-center gap-3">
                            <div className="bg-white p-3 rounded-2xl shadow-amber-500/20 shadow-md border border-amber-500/10 text-amber-400 font-bold uppercase tracking-widest text-xs flex flex-col items-center">
                               Target
                               <span className="text-3xl mt-1 leading-none text-amber-500">B</span>
                            </div>
                            <h3 className="font-bold text-slate-500 text-sm mt-2">변경 사항이 반영된 신버전</h3>
                         </div>
                      )}
                   </div>
               </div>

               {/* 2. TRIGGER BUTTON. Full-width so it clearly separates the UX flow */}
               <div className="w-full flex flex-col items-center" style={{ gap: '2rem', padding: '1rem 0' }}>
                  {compareError && (
                     <div className="px-6 py-5 bg-red-50 border border-red-100 rounded-3xl shadow-sm text-red-500 font-bold text-sm w-full flex justify-center items-center gap-3">
                         <AlertCircle style={{ width: '1.5rem', height: '1.5rem' }}/> {compareError}
                     </div>
                  )}
                  <button onClick={handleCompare} disabled={!oldFile || !newFile || isComparing} className={`w-full max-w-5xl py-7 rounded-3xl font-bold uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-4 active:scale-[0.99] ${(!oldFile || !newFile || isComparing) ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-indigo-500/30'}`} style={{ border: 'none', fontSize: '1.25rem' }}>
                      {isComparing ? <><Loader2 className="animate-spin" style={{ width: '1.75rem', height: '1.75rem' }}/> 리포트 생성 중...</> : <><GitCompare style={{ width: '1.75rem', height: '1.75rem' }}/> 비교 분석 실행</>}
                  </button>
               </div>

               {/* 3. RESULTS AREA (only shows when diff available) */}
               {diffResult && (
                  <div className="w-full glass bg-white shadow-xl flex flex-col animate-fade-in overflow-hidden" style={{ minHeight: '400px', background: 'rgba(255,255,255,0.95)', padding: '2rem', borderRadius: '2rem' }}>
                     
                     {/* Stats Header (2 cols on small, 4 on big logic) */}
                     <div className="w-full grid grid-cols-2 md:grid-cols-4" style={{ gap: '1rem', marginBottom: '3rem' }}>
                         {[
                           { k: 'added', l: '추가된 조항', c: '#22c55e', bg: 'rgba(34,197,94,0.05)', bgI: '#f0fdf4', border: 'rgba(34,197,94,0.2)', n: diffResult.stats.added },
                           { k: 'removed', l: '지워진 조항', c: '#ef4444', bg: 'rgba(239,68,68,0.05)', bgI: '#fef2f2', border: 'rgba(239,68,68,0.2)', n: diffResult.stats.removed },
                           { k: 'modified', l: '수정된 조항', c: '#f59e0b', bg: 'rgba(245,158,11,0.05)', bgI: '#fffbeb', border: 'rgba(245,158,11,0.2)', n: diffResult.stats.modified },
                           { k: 'unchanged', l: '동일한 유지', c: '#64748b', bg: 'rgba(100,116,139,0.05)', bgI: '#f8fafc', border: 'rgba(100,116,139,0.2)', n: diffResult.stats.unchanged }
                         ].map(stat => (
                             <div key={stat.k} className="p-6 rounded-3xl flex flex-col justify-between items-center text-center shadow-sm" style={{ backgroundColor: stat.bgI, border: `1px solid ${stat.border}` }}>
                                 <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">{stat.l}</span>
                                 <span className="text-4xl font-extrabold font-mono" style={{ color: stat.c, lineHeight: 1 }}>{stat.n}</span>
                             </div>
                         ))}
                     </div>

                     {/* Diff Blocks View */}
                     <div className="w-full flex flex-col" style={{ gap: '1rem' }}>
                        <div className="flex items-center gap-2 mb-2 pb-2" style={{ borderBottom: '2px solid rgba(0,56,130,0.1)' }}>
                           <Hash className="text-indigo-500" style={{ width: '1.25rem', height: '1.25rem' }}/>
                           <h3 className="text-lg font-bold text-slate-600">세부 변경 내역 및 리스트</h3>
                        </div>

                        {diffResult.diffs.filter(d => d.type !== 'unchanged').length === 0 ? (
                           <div className="w-full font-bold text-slate-400 uppercase tracking-widest text-center" style={{ padding: '4rem 0' }}>두 파일은 구조적으로 완벽히 동일합니다. 변경점이 없습니다.</div>
                        ) : (
                           diffResult.diffs.filter(d => d.type !== 'unchanged').map((d, index) => {
                               const isAdd = d.type === 'added';
                               const isRm = d.type === 'removed';
                               const isMod = d.type === 'modified';
                               
                               const color = isAdd ? '#22c55e' : isRm ? '#ef4444' : '#f59e0b';
                               const bgSoft = isAdd ? '#f0fdf4' : isRm ? '#fef2f2' : '#fffbeb';
                               const tag = isAdd ? '신설' : isRm ? '삭제' : '수정/변경';

                               return (
                                 <div key={index} className="w-full flex flex-col p-6 rounded-2xl border shadow-sm" style={{ backgroundColor: bgSoft, borderColor: `${color}30` }}>
                                    
                                    <div className="w-full flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                           <span className="text-[10px] font-bold text-white uppercase tracking-widest px-2 py-1 rounded shadow-sm" style={{ backgroundColor: color }}>
                                             {tag}
                                           </span>
                                           <span className="text-xs font-mono font-bold" style={{ color: color }}>Block #{index+1}</span>
                                        </div>
                                    </div>

                                    <div className="w-full flex flex-col text-[15px] leading-relaxed break-words text-slate-800" style={{ gap: '1rem', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                                        {isAdd && <div>{d.after?.text}</div>}
                                        {isRm && <div style={{ textDecoration: 'line-through', textDecorationColor: `${color}80`, color: '#64748b' }}>{d.before?.text}</div>}
                                        {isMod && (
                                           <div className="flex flex-col" style={{ gap: '1rem' }}>
                                               <div className="p-4 rounded-xl border relative" style={{ backgroundColor: '#ffffff', borderColor: 'rgba(239,68,68,0.2)' }}>
                                                   <span className="absolute text-[9px] font-bold uppercase" style={{ top: '-8px', left: '12px', background: '#fef2f2', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '1px 6px', borderRadius: '4px' }}>Original (A)</span>
                                                   <div style={{ textDecoration: 'line-through', textDecorationColor: 'rgba(239,68,68,0.5)', color: '#64748b' }}>{d.before?.text || '(비교 불가능한 표/서식 영역)'}</div>
                                               </div>
                                               <div className="p-4 rounded-xl border relative" style={{ backgroundColor: '#ffffff', borderColor: 'rgba(34,197,94,0.2)' }}>
                                                   <span className="absolute text-[9px] font-bold uppercase" style={{ top: '-8px', left: '12px', background: '#f0fdf4', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e', padding: '1px 6px', borderRadius: '4px' }}>Changed (B)</span>
                                                   <div style={{ color: '#0f172a' }}>{d.after?.text || '(비교 불가능한 표/서식 영역)'}</div>
                                               </div>
                                           </div>
                                        )}
                                    </div>

                                 </div>
                               )
                           })
                        )}
                     </div>
                  </div>
               )}
           </main>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .markdown-body {
          font-family: 'Inter', sans-serif !important;
          line-height: 1.85 !important;
          word-break: keep-all;
        }
        .markdown-body p { 
           margin-bottom: 1rem !important; 
           line-height: 1.85 !important;
        }
        .markdown-body li {
           margin-bottom: 0.35rem !important;
           line-height: 1.85 !important;
        }
        .markdown-body ol, .markdown-body ul {
           padding-left: 1.5rem !important;
           margin-bottom: 1rem !important;
        }
        .line-breaks-preserved br { 
           display: block; 
           content: ""; 
           margin-top: 8px; 
        }
        .markdown-body table {
           width: 100%;
           border-collapse: collapse;
           margin: 1.5rem 0;
           font-size: 0.875rem;
        }
        .markdown-body th, .markdown-body td {
           border: 1px solid #cbd5e1;
           padding: 0.6rem 0.75rem;
           text-align: left;
           vertical-align: top;
           line-height: 1.6;
        }
        .markdown-body th {
           background: #f1f5f9;
           font-weight: 600;
           color: #334155;
        }
        .markdown-body td {
           white-space: pre-wrap;
           word-break: break-word;
        }
        /* Overriding global css body text */
        .glass, .flex, input, button {
           font-family: 'Inter', sans-serif;
        }
      `}} />
    </div>
  );
};

export default App;
