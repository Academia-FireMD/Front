import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-qr-code-share',
  templateUrl: './qr-code-share.component.html',
  styleUrls: ['./qr-code-share.component.scss']
})
export class QrCodeShareComponent implements OnChanges {
  @Input() url: string = '';
  @Input() title: string = 'Compartir';
  @Input() description: string = 'Comparte mediante el siguiente código QR o enlaces directos.';
  @Input() showSocialButtons: boolean = true;
  @Input() downloadFileName: string = 'qr-code';
  @Input() vertical: boolean = false;

  public qrCodeUrl: string = '';
  public isGenerating: boolean = false;

  constructor(private toast: ToastrService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['url'] && this.url) {
      this.generateQRCode();
    }
  }

  public generateQRCode(): void {
    if (!this.url) return;

    this.isGenerating = true;

    // Generar QR usando un servicio externo
    this.qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(this.url)}`;

    // Simular un pequeño retraso para mostrar el estado de carga
    setTimeout(() => {
      this.isGenerating = false;
    }, 500);
  }

  public downloadQRCode(): void {
    if (!this.qrCodeUrl) return;

    // Crear un elemento canvas temporal para manipular la imagen
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const img = new Image();

    // Cuando la imagen se cargue, dibujarla en el canvas y descargarla
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Convertir el canvas a una URL de datos
      const dataUrl = canvas.toDataURL('image/png');

      // Crear un enlace de descarga
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${this.downloadFileName}.png`;

      // Simular un clic en el enlace para iniciar la descarga
      document.body.appendChild(link);
      link.click();

      // Limpiar
      document.body.removeChild(link);
      this.toast.success('Código QR descargado correctamente');
    };

    // Manejar errores de carga de imagen
    img.onerror = () => {
      this.toast.error('No se pudo descargar el código QR');
    };

    // Establecer el origen de la imagen y comenzar la carga
    img.crossOrigin = 'Anonymous'; // Importante para evitar problemas CORS
    img.src = this.qrCodeUrl;
  }

  public copyToClipboard(inputElement: HTMLInputElement): void {
    inputElement.select();
    document.execCommand('copy');
    this.toast.success('Enlace copiado al portapapeles');
  }

  public shareOnWhatsApp(): void {
    const text = `Accede a este enlace: ${this.url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  public shareOnTelegram(): void {
    const text = `Accede a este enlace: ${this.url}`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(this.url)}&text=${encodeURIComponent(text)}`, '_blank');
  }

  public shareByEmail(): void {
    const subject = 'Enlace compartido';
    const body = `Te comparto este enlace: ${this.url}`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  }

  public shareOnTwitter(): void {
    const text = `Accede a este enlace: ${this.url}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  }
}
