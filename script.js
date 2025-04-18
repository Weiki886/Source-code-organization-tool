document.addEventListener('DOMContentLoaded', () => {
    const folderInput = document.getElementById('folderInput');
    const outputName = document.getElementById('outputName');
    const outputFormat = document.getElementById('outputFormat');
    const removeComments = document.getElementById('removeComments');
    const removeEmptyLines = document.getElementById('removeEmptyLines');
    const showFilenames = document.getElementById('showFilenames');
    const processBtn = document.getElementById('processBtn');
    const status = document.getElementById('status');
    const fileList = document.getElementById('fileList');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const deselectAllBtn = document.getElementById('deselectAllBtn');

    let files = [];
    let selectedFiles = new Set();

    // 监听文件选择事件
    folderInput.addEventListener('change', (e) => {
        files = Array.from(e.target.files);
        selectedFiles.clear();
        
        // 显示已选择的文件并添加复选框
        fileList.innerHTML = '';
        
        if (files.length === 0) {
            showStatus('未找到文件', 'error');
            return;
        }
        
        // 添加提示信息
        const tipElement = document.createElement('div');
        tipElement.className = 'file-tip';
        tipElement.innerHTML = '提示：二进制文件（如.class、.jar等编译文件）会被自动识别并标记为灰色，它们不能被处理。';
        fileList.appendChild(tipElement);
        
        // 默认选择所有非二进制文件
        files.forEach((file, index) => {
            if (!isLikelyBinaryFile(file)) {
                selectedFiles.add(index);
            }
        });
        
        // 创建文件列表
        files.forEach((file, index) => {
            const isBinary = isLikelyBinaryFile(file);
            const fileItem = document.createElement('div');
            fileItem.classList.add('file-item');
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `file-${index}`;
            checkbox.checked = selectedFiles.has(index);
            checkbox.disabled = isBinary;
            
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    selectedFiles.add(index);
                } else {
                    selectedFiles.delete(index);
                }
            });
            
            const label = document.createElement('label');
            label.htmlFor = `file-${index}`;
            label.textContent = file.webkitRelativePath || file.name;
            
            if (isBinary) {
                label.style.color = '#999';
                const extension = getFileExtension(file.name).toLowerCase();
                if (extension === 'class' || extension === 'jar') {
                    label.title = 'Java编译文件，无法作为文本处理';
                } else {
                    label.title = '二进制文件，无法处理';
                }
            }
            
            fileItem.appendChild(checkbox);
            fileItem.appendChild(label);
            fileList.appendChild(fileItem);
        });
        
        const binaryCount = files.length - selectedFiles.size;
        showStatus(`已找到 ${files.length} 个文件，${selectedFiles.size} 个可处理文件已选择，${binaryCount} 个二进制文件已排除`, '');
    });
    
    // 全选按钮
    selectAllBtn.addEventListener('click', () => {
        const checkboxes = fileList.querySelectorAll('input[type="checkbox"]:not(:disabled)');
        checkboxes.forEach((checkbox) => {
            checkbox.checked = true;
            selectedFiles.add(parseInt(checkbox.id.replace('file-', '')));
        });
        
        showStatus(`已选择 ${selectedFiles.size} 个文件`, '');
    });
    
    // 取消全选按钮
    deselectAllBtn.addEventListener('click', () => {
        const checkboxes = fileList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        selectedFiles.clear();
        
        showStatus('已取消选择所有文件', '');
    });

    // 处理按钮点击事件
    processBtn.addEventListener('click', async () => {
        if (files.length === 0) {
            showStatus('请先选择一个文件夹', 'error');
            return;
        }

        if (selectedFiles.size === 0) {
            showStatus('请至少选择一个文件进行处理', 'error');
            return;
        }

        if (!outputName.value.trim()) {
            showStatus('请输入输出文件名', 'error');
            return;
        }

        showStatus('正在处理文件...', '');
        
        try {
            const selectedFilesArray = Array.from(selectedFiles).map(index => files[index]);
            const processedContent = await processFiles(
                selectedFilesArray, 
                removeComments.checked, 
                removeEmptyLines.checked,
                showFilenames.checked
            );
            
            if (!processedContent.trim()) {
                showStatus('处理后的内容为空，请检查选择的文件', 'error');
                return;
            }
            
            const format = outputFormat.value;
            const fileName = outputName.value.trim();
            
            showStatus(`正在生成${format.toUpperCase()}文件...`, '');
            
            switch (format) {
                case 'txt':
                    downloadTxtFile(processedContent, fileName);
                    showStatus(`处理完成！${format.toUpperCase()} 文件已下载。`, 'success');
                    break;
                case 'docx':
                    downloadDocxFile(processedContent, fileName);
                    // 状态信息会在downloadDocxFile函数中更新
                    break;
                case 'pdf':
                    downloadPdfFile(processedContent, fileName);
                    // 状态信息会在downloadPdfFile函数中更新
                    break;
                default:
                    downloadTxtFile(processedContent, fileName);
                    showStatus(`处理完成！TXT 文件已下载。`, 'success');
            }
        } catch (error) {
            console.error('处理错误:', error);
            showStatus(`处理过程中出错: ${error.message}`, 'error');
        }
    });

    // 处理文件的函数
    async function processFiles(files, shouldRemoveComments, shouldRemoveEmptyLines, shouldShowFilenames) {
        let result = '';
        
        for (const file of files) {
            try {
                // 跳过二进制文件和非文本文件
                if (isLikelyBinaryFile(file)) {
                    continue;
                }
                
                const content = await readFile(file);
                let processedContent = content;
                
                if (shouldRemoveComments) {
                    processedContent = removeCodeComments(processedContent, getFileExtension(file.name));
                }
                
                if (shouldRemoveEmptyLines) {
                    processedContent = processedContent
                        .split('\n')
                        .filter(line => line.trim() !== '')
                        .join('\n');
                }
                
                if (processedContent.trim()) {
                    // 根据用户选择是否显示文件名
                    if (shouldShowFilenames) {
                        result += `/* 文件: ${file.webkitRelativePath || file.name} */\n`;
                    }
                    
                    result += processedContent;
                    
                    // 只在内容之后添加一个换行符，避免多余空行
                    if (result[result.length - 1] !== '\n') {
                        result += '\n';
                    }
                }
            } catch (error) {
                console.warn(`处理文件 ${file.name} 时出错: ${error.message}`);
            }
        }
        
        return result;
    }

    // 读取文件内容的辅助函数
    function readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                resolve(event.target.result);
            };
            
            reader.onerror = (error) => {
                reject(error);
            };
            
            reader.readAsText(file);
        });
    }

    // 根据文件类型删除代码注释的函数
    function removeCodeComments(content, fileExtension) {
        switch (fileExtension.toLowerCase()) {
            case 'js':
            case 'ts':
            case 'jsx':
            case 'tsx':
            case 'c':
            case 'cpp':
            case 'java':
            case 'cs':
            case 'go':
            case 'swift':
            case 'kt':
            case 'php':
                // 删除 /* */ 注释
                content = content.replace(/\/\*[\s\S]*?\*\//g, '');
                // 删除 // 注释
                content = content.replace(/\/\/.*$/gm, '');
                break;
                
            case 'py':
                // 删除 """ """ 注释
                content = content.replace(/"""[\s\S]*?"""/g, '');
                // 删除 ''' ''' 注释
                content = content.replace(/'''[\s\S]*?'''/g, '');
                // 删除 # 注释
                content = content.replace(/#.*$/gm, '');
                break;
                
            case 'html':
            case 'xml':
            case 'svg':
                // 删除 <!-- --> 注释
                content = content.replace(/<!--[\s\S]*?-->/g, '');
                break;
                
            case 'css':
            case 'scss':
            case 'sass':
                // 删除 /* */ 注释
                content = content.replace(/\/\*[\s\S]*?\*\//g, '');
                break;
                
            // 根据需要为其他语言添加更多处理方式
        }
        
        return content;
    }

    // 下载TXT文件的函数
    function downloadTxtFile(content, filename) {
        // 确保文件名有 .txt 扩展名
        if (!filename.toLowerCase().endsWith('.txt')) {
            filename += '.txt';
        }
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        downloadFile(url, filename);
    }
    
    // 下载DOCX文件的函数
    function downloadDocxFile(content, filename) {
        // 确保文件名有 .docx 扩展名
        if (!filename.toLowerCase().endsWith('.docx')) {
            filename += '.docx';
        }
        
        try {
            // 检查docx库是否正确加载
            if (typeof docx === 'undefined') {
                throw new Error('DOCX库未正确加载');
            }
            
            // 将文本内容分割成行
            const lines = content.split('\n');
            
            // 创建段落
            const paragraphs = lines.map(line => {
                return new docx.Paragraph({
                    children: [
                        new docx.TextRun({
                            text: line,
                            font: "Courier New",
                            size: 22, // 2*11 pt
                        })
                    ]
                });
            });
            
            // 创建文档
            const doc = new docx.Document({
                sections: [{
                    properties: {},
                    children: paragraphs
                }]
            });
            
            // 生成并下载文档
            docx.Packer.toBlob(doc)
                .then(blob => {
                    // 创建URL并触发下载
                    const url = window.URL.createObjectURL(blob);
                    downloadFile(url, filename);
                    showStatus(`处理完成！DOCX 文件已下载。`, 'success');
                })
                .catch(error => {
                    console.error('DOCX生成错误:', error);
                    showStatus('DOCX生成失败，请尝试TXT格式。', 'error');
                });
        } catch (error) {
            console.error('DOCX生成错误:', error);
            showStatus('DOCX生成失败，请尝试TXT格式。', 'error');
            // 失败时回退到TXT格式
            downloadTxtFile(content, filename.replace('.docx', ''));
        }
    }
    
    // 下载PDF文件的函数
    function downloadPdfFile(content, filename) {
        // 确保文件名有 .pdf 扩展名
        if (!filename.toLowerCase().endsWith('.pdf')) {
            filename += '.pdf';
        }
        
        try {
            // 创建一个临时的HTML容器来存放内容
            const container = document.createElement('div');
            container.style.fontFamily = 'monospace';
            container.style.fontSize = '10pt';
            container.style.whiteSpace = 'pre-wrap';
            container.style.padding = '20px';
            
            // 添加内容，保留格式
            const lines = content.split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    const lineDiv = document.createElement('div');
                    lineDiv.textContent = line;
                    container.appendChild(lineDiv);
                }
            });
            
            // 添加到body但不显示
            container.style.position = 'absolute';
            container.style.left = '-9999px';
            document.body.appendChild(container);
            
            // 使用html2pdf库生成PDF
            const opt = {
                margin: [10, 10],
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            
            html2pdf().set(opt).from(container).save().then(() => {
                // 从DOM中移除临时容器
                document.body.removeChild(container);
                showStatus(`处理完成！PDF 文件已下载。`, 'success');
            }).catch(error => {
                console.error('PDF生成错误:', error);
                document.body.removeChild(container);
                showStatus('PDF生成失败，请尝试其他格式。', 'error');
            });
        } catch (error) {
            console.error('PDF生成错误:', error);
            showStatus('PDF生成失败，请尝试其他格式。', 'error');
        }
    }
    
    // 通用下载文件的辅助函数
    function downloadFile(url, filename) {
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    // 获取文件扩展名的辅助函数
    function getFileExtension(filename) {
        return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
    }

    // 显示状态消息的辅助函数
    function showStatus(message, type) {
        status.textContent = message;
        status.className = 'status show';
        
        if (type) {
            status.classList.add(type);
        }
    }

    // 检查文件是否可能是二进制文件的辅助函数
    function isLikelyBinaryFile(file) {
        // 常见的二进制文件扩展名
        const binaryExtensions = [
            'jpg', 'jpeg', 'png', 'gif', 'bmp', 'ico', 'svg',
            'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx',
            'zip', 'rar', '7z', 'tar', 'gz',
            'mp3', 'mp4', 'wav', 'avi', 'mov',
            'exe', 'dll', 'so', 'dylib',
            'ttf', 'otf', 'woff', 'woff2',
            'class', 'jar', 'war', 'ear', // Java编译文件
            'pyc', 'pyo', // Python编译文件
            'o', 'obj', 'a', 'lib', 'so', 'dylib', // C/C++编译文件
            'bin', 'dat', 'db', 'sqlite', 'mdb', 'accdb' // 数据库和通用二进制文件
        ];
        
        const extension = getFileExtension(file.name).toLowerCase();
        
        // 检查扩展名是否在二进制文件列表中
        if (binaryExtensions.includes(extension)) {
            return true;
        }
        
        // 检查文件大小（超过10MB的文件可能是二进制文件）
        if (file.size > 10 * 1024 * 1024) {
            return true;
        }
        
        return false;
    }
}); 