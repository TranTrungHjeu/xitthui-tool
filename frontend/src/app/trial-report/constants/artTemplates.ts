export interface ArtCapabilityLevel {
  score: 1 | 2 | 3 | 4;
  description: string;
}

export const technologyLevels: ArtCapabilityLevel[] = [
  { score: 1, description: "Chưa làm quen hoặc gặp nhiều khó khăn khi sử dụng iPad, phần mềm vẽ hoặc công cụ (layer, undoredo)." },
  { score: 2, description: "Sử dụng được một số công cụ cơ bản nhưng gặp khó khăn khi kết hợp nhiều tính năng hoặc cần hỗ trợ thường xuyên." },
  { score: 3, description: "Vận dụng thành thạo, tự tin sử dụng iPad và các công cụ trong phần mềm để vẽ, chỉnh sửa hình ảnh mà ít gặp khó khăn." },
  { score: 4, description: "Sử dụng thành thạo, vận dụng sáng tạo công cụ để tạo ra tác phẩm phức tạp, độc đáo, khả năng tự khám phá tính năng mới." },
];

export const creativityLevels: ArtCapabilityLevel[] = [
  { score: 1, description: "Thiếu sáng tạo, thường sao chép trực tiếp mẫu vật hoặc chưa có sự đóng góp ý tưởng riêng." },
  { score: 2, description: "Ý tưởng cơ bản nhưng còn đơn giản, phụ thuộc nhiều vào mẫu có sẵn, chưa thể hiện được cá tính riêng." },
  { score: 3, description: "Bạt vế có tính sáng tạo, ý tưởng cơ bản nhưng có đóng góp cá nhân, mạnh dạn thể hiện phong cách riêng." },
  { score: 4, description: "Ý tưởng độc đáo, sáng tạo cao, kết hợp nhiều ý tưởng một cách hài hòa, có phong cách cá nhân nổi bật." },
];

export const designPrinciplesLevels: ArtCapabilityLevel[] = [
  { score: 1, description: "Chưa hiểu rõ các nguyên tắc cơ bản về màu sắc, bố cục, cân bằng; tác phẩm thiếu tính thẩm mỹ hoặc chưa có sự hoàn thiện." },
  { score: 2, description: "Có hiểu biết hạn chế, nhưng chưa áp dụng đúng nguyên tắc vào tác phẩm; bố cục, màu sắc còn đơn giản." },
  { score: 3, description: "Hiểu và áp dụng đúng các nguyên tắc cơ bản, tác phẩm có sự cân đối về bố cục và màu sắc, đạt được sự hài hòa." },
  { score: 4, description: "Vận dụng sáng tạo nguyên tắc thiết kế, tác phẩm có chiều sâu, kết hợp nhiều yếu tố một cách tinh tế." },
];

export const artCommunicationLevels: ArtCapabilityLevel[] = [
  { score: 1, description: "Khó trình bày ý tưởng hoặc chưa truyền đạt ý tưởng rõ ràng trong bài trình bày." },
  { score: 2, description: "Trình bày ý tưởng cơ bản nhưng chưa rõ ràng, cần hỗ trợ để diễn đạt ý tưởng của mình." },
  { score: 3, description: "Trình bày được ý tưởng tương đối tốt, có thể giải thích các lựa chọn trong tác phẩm của mình." },
  { score: 4, description: "Diễn đạt rõ ràng và tự tin, có khả năng trình bày ý tưởng sáng tạo một cách mạch lạc." },
];

export const selfLearningLevels: ArtCapabilityLevel[] = [
  { score: 1, description: "Ít chủ động và không có sự tìm hiểu hoặc khám phá thêm các tính năng của công cụ, phần mềm." },
  { score: 2, description: "Chủ động học hỏi thêm một số kỹ thuật nhưng thường cần được gợi ý hoặc hướng dẫn thêm." },
  { score: 3, description: "Tự chủ và biết tìm hiểu, khám phá thử các công cụ mới, nhận phản hồi và cải thiện tác phẩm." },
  { score: 4, description: "Thể hiện sự tự học cao, chủ động tích cực tìm hiểu thêm các kỹ thuật mới và sử dụng phản hồi để phát triển." },
];
