"""
PyTorch CRNN Model Architecture for Vietnamese Handwriting Line Recognition.
Architecture: 4-block Conv2D + GroupNorm(8, C) + BiLSTM(128) + Linear(num_classes).
"""
import torch
import torch.nn as nn


class CRNN(nn.Module):
    """
    Convolutional Recurrent Neural Network for text line recognition.
    Expects input shape: [B, 3, 64, 1024].
    Output shape: [B, 128, num_classes].
    """

    def __init__(self, num_classes: int, dropout: float = 0.2):
        super().__init__()
        self.cnn = nn.Sequential(
            nn.Conv2d(3, 64, 3, padding=1),
            nn.GroupNorm(8, 64),
            nn.ReLU(),
            nn.MaxPool2d(2, 2),  # -> [B, 64, 32, 512]
            nn.Conv2d(64, 128, 3, padding=1),
            nn.GroupNorm(8, 128),
            nn.ReLU(),
            nn.MaxPool2d(2, 2),  # -> [B, 128, 16, 256]
            nn.Conv2d(128, 256, 3, padding=1),
            nn.GroupNorm(8, 256),
            nn.ReLU(),
            nn.MaxPool2d(2, 2),  # -> [B, 256, 8, 128]
            nn.Conv2d(256, 512, 3, padding=1),
            nn.GroupNorm(8, 512),
            nn.ReLU(),           # -> [B, 512, 8, 128]
        )
        # 512 * 8 = 4096 features per timestep
        self.rnn = nn.LSTM(4096, 128, 1, bidirectional=True, batch_first=True)
        self.dropout = nn.Dropout(dropout)
        self.fc = nn.Linear(256, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        feat = self.cnn(x)
        B, C, H, W = feat.size()
        feat = feat.permute(0, 3, 1, 2).contiguous().view(B, W, C * H)
        rnn_out, _ = self.rnn(feat)
        rnn_out = self.dropout(rnn_out)
        return self.fc(rnn_out)
