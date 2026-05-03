import { useEffect, useMemo, useRef, useState } from 'react';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000').replace(/\/$/, '');
const PROTECT_ENDPOINT = `${API_BASE_URL}/api/v1/protect`;
const acceptedTypes = ['image/png', 'image/jpeg', 'image/webp'];
const protectionModes = ['low', 'mid', 'high'];
const logoUrl = `${import.meta.env.BASE_URL}logo.png`;
const initialResultMeta = {
  detectedFaces: '',
  protectionMode: '',
  contentType: '',
};

const formatFileSize = (bytes) => {
  if (!bytes) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** power;
  return `${value.toFixed(power === 0 ? 0 : 1)} ${units[power]}`;
};

const getReadableFormat = (mimeType) => {
  if (!mimeType) {
    return 'Неизвестно';
  }

  const normalizedMimeType = mimeType.toLowerCase();

  if (normalizedMimeType.includes('png')) {
    return 'PNG';
  }

  if (normalizedMimeType.includes('jpeg') || normalizedMimeType.includes('jpg')) {
    return 'JPG';
  }

  if (normalizedMimeType.includes('webp')) {
    return 'WEBP';
  }

  return mimeType.replace('image/', '').toUpperCase() || 'Неизвестно';
};

const getOutputFormat = (mimeType) => {
  if (mimeType === 'image/jpeg') {
    return 'jpg';
  }

  if (mimeType === 'image/webp') {
    return 'webp';
  }

  return 'png';
};

const buildFallbackFilename = (fileName, outputFormat) => {
  const safeOutputFormat = outputFormat || 'png';
  const baseName = fileName?.replace(/\.[^./\\]+$/, '') || 'protected';
  return `${baseName}-protected.${safeOutputFormat}`;
};

const parseContentDispositionFilename = (headerValue) => {
  if (!headerValue) {
    return '';
  }

  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);

  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim().replace(/^"(.*)"$/, '$1'));
    } catch {
      return utf8Match[1].trim().replace(/^"(.*)"$/, '$1');
    }
  }

  const fileNameMatch = headerValue.match(/filename=(?:"([^"]+)"|([^;]+))/i);
  return fileNameMatch?.[1] || fileNameMatch?.[2]?.trim() || '';
};

const getErrorMessage = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  let detail = '';

  if (contentType.includes('application/json')) {
    try {
      const payload = await response.json();
      detail = payload?.detail || '';
    } catch {
      detail = '';
    }
  } else {
    try {
      detail = (await response.text()).trim();
    } catch {
      detail = '';
    }
  }

  if (response.status === 422 && detail.toLowerCase().includes('no face')) {
    return 'Лицо на изображении не найдено. Попробуйте выбрать фото, где лицо видно целиком.';
  }

  if (response.status === 400) {
    return detail || 'Сервер не смог принять файл. Проверьте, что это корректное изображение.';
  }

  if (response.status >= 500) {
    return 'На сервере произошла ошибка при обработке изображения. Попробуйте ещё раз чуть позже.';
  }

  return detail || `Не удалось обработать изображение. Код ответа: ${response.status}.`;
};

export default function App() {
  const abortControllerRef = useRef(null);
  const inputRef = useRef(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState('low');
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState('');
  const [resultBlob, setResultBlob] = useState(null);
  const [resultPreviewUrl, setResultPreviewUrl] = useState('');
  const [resultFileName, setResultFileName] = useState('');
  const [resultMeta, setResultMeta] = useState(initialResultMeta);
  const [uiState, setUiState] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  useEffect(() => {
    if (!file) {
      setSourcePreviewUrl('');
      return undefined;
    }

    const objectUrl = URL.createObjectURL(file);
    setSourcePreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  useEffect(() => {
    if (!resultBlob) {
      setResultPreviewUrl('');
      return undefined;
    }

    const objectUrl = URL.createObjectURL(resultBlob);
    setResultPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [resultBlob]);

  const resetResultState = () => {
    setResultBlob(null);
    setResultFileName('');
    setResultMeta(initialResultMeta);
  };

  const statusContent = useMemo(() => {
    if (uiState === 'processing') {
      return {
        title: 'Обработка запущена',
        description: 'Изображение отправлено на сервер. Как только ответ придёт, превью обновится автоматически.',
      };
    }

    if (uiState === 'success') {
      return {
        title: 'Готово',
        description: 'Показан результат от backend API. Его можно сразу скачать на устройство.',
      };
    }

    if (uiState === 'error') {
      return {
        title: 'Есть проблема',
        description: errorMessage,
      };
    }

    if (file) {
      return {
        title: 'Файл готов к отправке',
        description: 'Выберите режим защиты и нажмите кнопку запуска обработки.',
      };
    }

    return {
      title: 'Загрузите изображение',
      description: 'Поддерживаются форматы PNG, JPG и WEBP. После выбора файла можно сразу запустить обработку.',
    };
  }, [errorMessage, file, uiState]);

  const activePreviewUrl = resultPreviewUrl || sourcePreviewUrl;
  const previewTitle = resultPreviewUrl ? 'Обработанное изображение' : file ? 'Исходное изображение' : 'Изображение пока не выбрано';
  const previewAlt = resultPreviewUrl
    ? 'Превью обработанного изображения'
    : 'Превью загруженного изображения';

  const fileMeta = useMemo(() => {
    if (uiState === 'success' && resultBlob) {
      return [
        { label: 'Результат', value: resultFileName || 'Файл готов' },
        { label: 'Найдено лиц', value: resultMeta.detectedFaces || 'Не указано' },
        { label: 'Режим защиты', value: resultMeta.protectionMode || mode },
        { label: 'Формат', value: getReadableFormat(resultMeta.contentType || resultBlob.type) },
      ];
    }

    if (!file) {
      return [
        { label: 'Статус', value: 'Ожидает загрузки' },
        { label: 'Режим защиты', value: mode },
        { label: 'Превью результата', value: 'Пока нет' },
        { label: 'Скачивание', value: 'Недоступно' },
      ];
    }

    return [
      { label: 'Имя файла', value: file.name },
      { label: 'Формат', value: getReadableFormat(file.type) },
      { label: 'Размер', value: formatFileSize(file.size) },
      { label: 'Режим защиты', value: mode },
    ];
  }, [file, mode, resultBlob, resultFileName, resultMeta.contentType, resultMeta.detectedFaces, resultMeta.protectionMode, uiState]);

  const statusClassName = [
    'status-panel',
    uiState === 'processing' ? 'is-processing' : '',
    uiState === 'success' ? 'is-success' : '',
    uiState === 'error' ? 'is-error' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const handleIncomingFile = (incomingFile) => {
    if (!incomingFile) {
      return;
    }

    if (!incomingFile.type.startsWith('image/')) {
      setUiState('error');
      setErrorMessage('Можно загрузить только изображение в формате PNG, JPG или WEBP.');
      return;
    }

    if (!acceptedTypes.includes(incomingFile.type)) {
      setUiState('error');
      setErrorMessage('Формат не поддерживается. Используйте PNG, JPG или WEBP.');
      return;
    }

    abortControllerRef.current?.abort();
    setFile(incomingFile);
    resetResultState();
    setUiState('idle');
    setErrorMessage('');
  };

  const handleInputChange = (event) => {
    const incomingFile = event.target.files?.[0];
    handleIncomingFile(incomingFile);
    event.target.value = '';
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragActive(false);
    const incomingFile = event.dataTransfer.files?.[0];
    handleIncomingFile(incomingFile);
  };

  const handleClear = () => {
    abortControllerRef.current?.abort();
    setFile(null);
    setIsDragActive(false);
    resetResultState();
    setUiState('idle');
    setErrorMessage('');

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleProcess = async () => {
    if (!file || uiState === 'processing') {
      return;
    }

    const outputFormat = getOutputFormat(file.type);
    const controller = new AbortController();

    abortControllerRef.current?.abort();
    abortControllerRef.current = controller;
    resetResultState();
    setUiState('processing');
    setErrorMessage('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);
    formData.append('output_format', outputFormat);

    try {
      const response = await fetch(PROTECT_ENDPOINT, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        setUiState('error');
        setErrorMessage(await getErrorMessage(response));
        return;
      }

      const blob = await response.blob();
      const contentType = response.headers.get('content-type') || blob.type;

      if (contentType && !contentType.startsWith('image/')) {
        throw new Error('unexpected-response');
      }

      const resolvedFormat = getOutputFormat(contentType || file.type);
      const contentDisposition = response.headers.get('content-disposition');
      const detectedFaces = response.headers.get('x-detected-faces') || '';
      const protectionMode = response.headers.get('x-protection-mode') || mode;

      setResultBlob(blob);
      setResultFileName(
        parseContentDispositionFilename(contentDisposition) || buildFallbackFilename(file.name, resolvedFormat),
      );
      setResultMeta({
        detectedFaces,
        protectionMode,
        contentType,
      });
      setUiState('success');
    } catch (error) {
      if (error.name === 'AbortError') {
        return;
      }

      setUiState('error');
      setErrorMessage(
        error.message === 'unexpected-response'
          ? 'Сервер вернул неожиданный ответ вместо изображения.'
          : `Сервер недоступен. Проверьте, что backend запущен по адресу ${API_BASE_URL}.`,
      );
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  const handleDownload = () => {
    if (!resultBlob) {
      return;
    }

    const downloadUrl = URL.createObjectURL(resultBlob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = resultFileName || buildFallbackFilename(file?.name, getOutputFormat(resultBlob.type));
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => {
      URL.revokeObjectURL(downloadUrl);
    }, 0);
  };

  const openFilePicker = () => {
    inputRef.current?.click();
  };

  return (
    <div className="page-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <header className="topbar">
        <a className="brand" href="#hero">
          <img className="brand-logo" src={logoUrl} alt="Логотип NeuraShield" />
          <span>NeuraShield</span>
        </a>

        <nav className="topnav">
          <a href="#workspace">Загрузка</a>
          <a href="#features">Возможности</a>
          <a href="#preview">Превью</a>
        </nav>
      </header>

      <main>
        <section className="hero" id="hero">
          <div className="hero-copy">
            <p className="eyebrow">NeuraShield</p>
            <h1>Защитите изображение перед публикацией</h1>
            <p className="hero-text">
              Загрузите изображение, отправьте его на обработку в backend API и
              скачайте уже защищённую версию в том же рабочем окне.
            </p>

            <div className="hero-actions">
              <button className="primary-button" type="button" onClick={openFilePicker}>
                Выбрать изображение
              </button>
              <a className="secondary-link" href="#workspace">
                Перейти к рабочей области
              </a>
            </div>

            <div className="hero-badges">
              <span>Защита изображений</span>
              <span>Реальная обработка на сервере</span>
              <span>Готовый файл для скачивания</span>
            </div>
          </div>

          <div className="hero-panel">
            <div className="hero-card hero-card-main">
              <p className="card-label">Сервис</p>
              <h2>Приватная работа с изображениями в одном понятном потоке</h2>
              <p>
                NeuraShield объединяет загрузку, серверную обработку, просмотр
                результата и экспорт готового файла в одном окне.
              </p>
            </div>

            <div className="hero-card hero-card-accent">
              <span className="mini-pill">Преимущество</span>
              <p>
                Пользователь проходит короткий сценарий: выбрать файл, запустить
                защиту, увидеть результат и скачать его без лишних экранов.
              </p>
            </div>
          </div>
        </section>

        <section className="workspace" id="workspace">
          <div className="workspace-copy">
            <p className="eyebrow">Рабочая область</p>
            <h2>Загрузите файл и дождитесь готового результата от сервера.</h2>
            <p>
              Вся работа с изображением собрана в одном месте: загрузка, запуск
              обработки, обновлённое превью и скачивание итогового файла.
            </p>
          </div>

          <div className="workspace-grid">
            <div
              className={`upload-panel ${isDragActive ? 'is-drag-active' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              aria-busy={uiState === 'processing'}
            >
              <input
                ref={inputRef}
                className="hidden-input"
                type="file"
                accept={acceptedTypes.join(',')}
                onChange={handleInputChange}
              />

              <div className="dropzone-badge">Зона загрузки</div>
              <h3>Загрузите PNG, JPG или WEBP</h3>
              <p>
                Перетащите изображение в эту область или выберите файл вручную,
                затем отправьте его на обработку.
              </p>

              <div className="control-stack">
                <label className="field-label" htmlFor="protection-mode">
                  Режим защиты
                </label>
                <select
                  id="protection-mode"
                  className="mode-select"
                  value={mode}
                  onChange={(event) => setMode(event.target.value)}
                  disabled={uiState === 'processing'}
                >
                  {protectionModes.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <p className="helper-text">
                  `low` даёт более мягкую обработку, `high` усиливает защиту изображения.
                </p>
              </div>

              <div className="upload-panel-actions">
                <button className="ghost-button" type="button" onClick={openFilePicker}>
                  Выбрать файл
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={handleClear}
                  disabled={!file && !resultBlob}
                >
                  Очистить
                </button>
                <button
                  className="primary-button primary-button-wide"
                  type="button"
                  onClick={handleProcess}
                  disabled={!file || uiState === 'processing'}
                >
                  {uiState === 'processing' ? 'Обрабатываем...' : 'Запустить обработку'}
                </button>
              </div>

              {file ? (
                <div className="selected-file">
                  <strong>{file.name}</strong>
                  <span>
                    {getReadableFormat(file.type)} • {formatFileSize(file.size)}
                  </span>
                </div>
              ) : null}

              <div className={statusClassName}>
                <strong>{statusContent.title}</strong>
                <p>{statusContent.description}</p>
              </div>
            </div>

            <div className="preview-panel" id="preview" aria-busy={uiState === 'processing'}>
              <div className="panel-head">
                <div>
                  <p className="eyebrow eyebrow-small">Превью</p>
                  <h3>{previewTitle}</h3>
                </div>
                <button
                  className="download-button"
                  type="button"
                  onClick={handleDownload}
                  disabled={!resultBlob}
                >
                  Скачать результат
                </button>
              </div>

              <div className={`preview-stage ${uiState === 'processing' ? 'is-processing' : ''}`}>
                {activePreviewUrl ? (
                  <img src={activePreviewUrl} alt={previewAlt} />
                ) : (
                  <div className="preview-placeholder">
                    <span />
                    <p>Здесь появится превью изображения и затем обработанный результат</p>
                  </div>
                )}

                {uiState === 'processing' ? (
                  <div className="preview-overlay">
                    <div className="loader" aria-hidden="true" />
                    <p>Изображение обрабатывается на сервере...</p>
                  </div>
                ) : null}
              </div>

              <div className="meta-grid">
                {fileMeta.map((item) => (
                  <div className="meta-card" key={item.label}>
                    <p>{item.label}</p>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="features" id="features">
          <article className="feature-card">
            <p className="feature-number">01</p>
            <h3>Быстрая отправка</h3>
            <p>
              Изображение уходит на backend API через `FormData`, без
              дополнительной авторизации и лишних промежуточных шагов.
            </p>
          </article>

          <article className="feature-card">
            <p className="feature-number">02</p>
            <h3>Чистое превью</h3>
            <p>
              После ответа сервера интерфейс автоматически показывает уже
              обработанную версию изображения в основной панели превью.
            </p>
          </article>

          <article className="feature-card">
            <p className="feature-number">03</p>
            <h3>Простой экспорт</h3>
            <p>
              Пользователь скачивает именно результат обработки, включая имя файла
              из `Content-Disposition`, если сервер его передал.
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}
