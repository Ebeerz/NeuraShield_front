import { useEffect, useMemo, useRef, useState } from 'react';

const formatFileSize = (bytes) => {
  if (!bytes) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** power;
  return `${value.toFixed(power === 0 ? 0 : 1)} ${units[power]}`;
};

const acceptedTypes = ['image/png', 'image/jpeg', 'image/webp'];

export default function App() {
  const inputRef = useRef(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return undefined;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const fileMeta = useMemo(() => {
    if (!file) {
      return [
        { label: 'Статус', value: 'Ожидает загрузки' },
        { label: 'Режим', value: 'Подготовка изображения' },
        { label: 'Готово к скачиванию', value: 'Нет' },
      ];
    }

    return [
      { label: 'Имя файла', value: file.name },
      { label: 'Формат', value: file.type.replace('image/', '').toUpperCase() || 'Неизвестно' },
      { label: 'Размер', value: formatFileSize(file.size) },
    ];
  }, [file]);

  const handleIncomingFile = (incomingFile) => {
    if (!incomingFile) {
      return;
    }

    if (!incomingFile.type.startsWith('image/')) {
      return;
    }

    setFile(incomingFile);
  };

  const handleInputChange = (event) => {
    const incomingFile = event.target.files?.[0];
    handleIncomingFile(incomingFile);
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

  const handleDownload = () => {
    if (!file) {
      return;
    }

    const downloadUrl = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = file.name;
    anchor.click();
    URL.revokeObjectURL(downloadUrl);
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
          <img className="brand-logo" src="/logo.png" alt="Логотип NeuraShield" />
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
              Загрузите изображение, проверьте результат в рабочей области и
              скачайте готовый файл в аккуратном и понятном интерфейсе.
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
              <span>Быстрая загрузка</span>
              <span>Мгновенное превью</span>
            </div>
          </div>

          <div className="hero-panel">
            <div className="hero-card hero-card-main">
              <p className="card-label">Сервис</p>
              <h2>Приватная работа с изображениями в одном понятном потоке</h2>
              <p>
                NeuraShield объединяет загрузку, просмотр и экспорт изображения
                в одном окне, чтобы пользователь мог быстро подготовить файл к публикации.
              </p>
            </div>

            <div className="hero-card hero-card-accent">
              <span className="mini-pill">Преимущество</span>
              <p>
                Интерфейс сфокусирован на простом сценарии: загрузить файл,
                увидеть его сразу и без лишних действий получить результат.
              </p>
            </div>
          </div>
        </section>

        <section className="workspace" id="workspace">
          <div className="workspace-copy">
            <p className="eyebrow">Рабочая область</p>
            <h2>Загрузите файл и сразу получите готовое превью.</h2>
            <p>
              Вся работа с изображением собрана в одном месте: загрузка, просмотр
              и скачивание без перегруженного интерфейса.
            </p>
          </div>

          <div className="workspace-grid">
            <div
              className={`upload-panel ${isDragActive ? 'is-drag-active' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
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
                Перетащите изображение в эту область или выберите файл вручную.
              </p>

              <div className="upload-panel-actions">
                <button className="primary-button" type="button" onClick={openFilePicker}>
                  Выбрать файл
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => setFile(null)}
                  disabled={!file}
                >
                  Очистить
                </button>
              </div>
            </div>

            <div className="preview-panel" id="preview">
              <div className="panel-head">
                <div>
                  <p className="eyebrow eyebrow-small">Превью</p>
                  <h3>{file ? 'Загруженное изображение' : 'Изображение пока не выбрано'}</h3>
                </div>
                <button
                  className="download-button"
                  type="button"
                  onClick={handleDownload}
                  disabled={!file}
                >
                  Скачать файл
                </button>
              </div>

              <div className="preview-stage">
                {previewUrl ? (
                  <img src={previewUrl} alt="Превью загруженного изображения" />
                ) : (
                  <div className="preview-placeholder">
                    <span />
                    <p>Здесь появится превью загруженного изображения</p>
                  </div>
                )}
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
            <h3>Быстрая загрузка</h3>
            <p>
              Изображение сразу попадает в рабочую область и становится доступным
              для просмотра без лишних промежуточных экранов.
            </p>
          </article>

          <article className="feature-card">
            <p className="feature-number">02</p>
            <h3>Чистое превью</h3>
            <p>
              Пользователь сразу видит изображение в отдельной панели и может
              быстро проверить результат перед скачиванием.
            </p>
          </article>

          <article className="feature-card">
            <p className="feature-number">03</p>
            <h3>Простой экспорт</h3>
            <p>
              После загрузки файл можно получить обратно одним действием, без
              сложных настроек и лишних шагов.
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}
