import { ChangeEvent, useRef } from "react";

interface FileUploaderProps {
  fileName?: string;
  onFileSelect: (file: File) => void;
}

export function FileUploader({ fileName, onFileSelect }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(file);
      event.target.value = "";
    }
  };

  return (
    <div className="file-uploader">
      <button
        type="button"
        className="primary-button"
        onClick={() => inputRef.current?.click()}
      >
        Загрузить Excel
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleChange}
        hidden
      />
      <div className="file-meta">
        <span className="field-label">Файл</span>
        <strong>{fileName || "Файл не загружен"}</strong>
      </div>
    </div>
  );
}
