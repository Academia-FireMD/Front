import { Component, Input } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-avatar-upload',
  templateUrl: './avatar-upload.component.html',
  styleUrl: './avatar-upload.component.scss',
})
export class AvatarUploadComponent {
  uploadedFiles: File[] = [];
  uploading = false;
  @Input() avatarUrl!: string;
  constructor(
    private avatarService: UserService,
    private toast: ToastrService
  ) {}

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];

    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    this.uploading = true;

    try {
      const res = await firstValueFrom(
        this.avatarService.uploadAvatar$(formData)
      );
      this.toast.success('Avatar reemplazado!');
      this.avatarUrl = res.avatarUrl;
      this.uploading = false;
    } catch (error) {
      this.uploading = false;
    }
  }
}
