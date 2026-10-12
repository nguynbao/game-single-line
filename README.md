# Single Line: Một nét chỉ 🧵

Game giải đố **vẽ một nét** làm cho **YouTube Playables**, điện thoại và máy tính. Cách chơi: kéo sợi chỉ đi qua mọi đường giữa các chốt, mỗi đường chỉ đi đúng một lần và không được nhấc tay.

Cùng bộ công nghệ với Block Blast: **Phaser 3 + Vite + TypeScript**. Giao diện làm theo skill `frontend-design` (nằm trong `.agents/skills/frontend-design`).

---

## Cách chơi

- Chạm vào một chốt rồi kéo qua các đường để khâu chỉ.
- **Kéo ngược** về chốt vừa đi qua để gỡ mũi vừa khâu.
- **Đường đôi** (hai đường nét đứt song song) phải đi qua hai lần.
- Các nút công cụ:
  - **Lùi lại**: gỡ một bước.
  - **Làm lại**: xóa toàn bộ và khâu lại từ đầu.
  - **Gợi ý**: chỉ ra bước đúng tiếp theo. Nếu bạn đang đi vào ngõ cụt, gợi ý sẽ tự gỡ về chỗ còn đi tiếp được.
- Phím tắt: `Z` hoặc `Backspace` để lùi lại, `R` để làm lại, `H` để xem gợi ý, `Esc` để mở bảng chọn màn.

## 50 màn chơi, chia 5 chương

Mỗi chương có 10 màn và một màu chỉ riêng.

| Chương | Tên | Điểm mới |
|---|---|---|
| 1 | Sợi chỉ đầu tiên | Màn 1–5 vẽ tay (tam giác, nơ, phong bì…), sau đó là lưới ô vuông |
| 2 | Đường chéo | Xuất hiện đường chéo |
| 3 | Ngõ nhỏ | Hình lớn hơn, nhiều ngã rẽ hơn |
| 4 | Khâu hai lượt | Xuất hiện đường đôi |
| 5 | Thợ khâu lành nghề | Lưới 5×6, tối đa 3 đường đôi |

- Màn chơi được cấu hình sẵn trong `src/levels.ts`. File này được sinh ra bởi `scripts/generate-levels.mjs` với seed cố định, nên chạy lại vẫn ra đúng 50 màn như cũ.
- Mọi màn đều giải được, vì mỗi màn được tạo từ chính một đường đi một nét.
- Độ khó được đo bằng tỉ lệ thắng nếu chọn đường ngẫu nhiên: khoảng 80% ở màn 6 và giảm dần còn khoảng 2–3% ở màn 50.
- Tiến trình chơi được lưu qua `ytgame.game.saveData`. Khi chạy ngoài YouTube thì lưu bằng `localStorage`.
- Hoàn thành một màn mà **không dùng gợi ý** sẽ được thêm chấm vàng ở bảng chọn màn.

## Lệnh

```bash
npm install
npm run dev      # http://localhost:3001
npm run build    # tạo thư mục dist/, nén nội dung dist/ thành .zip để tải lên YouTube Playables
npm run levels   # sinh lại src/levels.ts sau khi sửa generator
```

Muốn đổi màn chơi thì sửa `HAND_LEVELS` hoặc `paramsFor()` trong `scripts/generate-levels.mjs`, rồi chạy `npm run levels`.
