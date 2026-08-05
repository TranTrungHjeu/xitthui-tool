export interface CapabilityLevel {
  score: 1 | 2 | 3 | 4 | 5;
  description: string;
}

export const recognitionLevels: CapabilityLevel[] = [
  { score: 1, description: "Không phân biệt được thiết bị điện tử và chi tiết lắp ráp, cần hỗ trợ nhiều." },
  { score: 2, description: "Nhận biết được một vài thiết bị nhưng còn nhầm lẫn, cần nhắc lại nhiều." },
  { score: 3, description: "Phân biệt đúng thiết bị điện tử và chi tiết lắp ráp, nhận diện được tên." },
  { score: 4, description: "Ghi nhớ được chức năng cơ bản của từng thiết bị (như động cơ, cảm biến)." },
  { score: 5, description: "Hiểu chức năng và biết vận dụng sáng tạo trong thiết kế mô hình." },
];

export const assemblyLevels: CapabilityLevel[] = [
  { score: 1, description: "Chưa chọn đúng chi tiết và không xác định được hướng và vị trí lắp ráp." },
  { score: 2, description: "Chọn đúng chi tiết, nhưng không xác định được hướng hoặc vị trí đúng, cần hỗ trợ thường xuyên." },
  { score: 3, description: "Chọn đúng chi tiết, xác định được hướng và vị trí lắp ráp, nhưng đôi khi mắc lỗi, cần nhắc nhở để sửa sai." },
  { score: 4, description: "Lắp ráp chính xác, đôi khi sai nhưng có thể sửa lại khi được gợi ý." },
  { score: 5, description: "Lắp ráp chính xác, có thể tự sửa sai mà không cần hỗ trợ." },
];

export const programmingLevels: CapabilityLevel[] = [
  { score: 1, description: "Chưa kéo thả được khối lệnh, gặp nhiều khó khăn dù được hỗ trợ." },
  { score: 2, description: "Kéo thả được nhưng vẫn còn nhầm lẫn chức năng khối lệnh, cần hướng dẫn." },
  { score: 3, description: "Biết kéo thả và dùng đúng chức năng khối lệnh, đôi lúc sai nhưng tự sửa được khi gợi ý." },
  { score: 4, description: "Hoàn thành ít nhất 1 nhiệm vụ, sử dụng đúng các khối lệnh." },
  { score: 5, description: "Hoàn thành hết tất cả nhiệm vụ, có sự sáng tạo trong chương trình." },
];

export const communicationLevels: CapabilityLevel[] = [
  { score: 1, description: "Chưa chủ động giao tiếp, ngại trả lời khi được hỏi. Chưa hợp tác trong buổi trải nghiệm." },
  { score: 2, description: "Có tương tác với giáo viên nhưng chưa chủ động, chỉ trả lời khi được hỏi." },
  { score: 3, description: "Hợp tác với giáo viên, nhưng còn nhút nhát, chưa tự tin chia sẻ." },
  { score: 4, description: "Giao tiếp một cách tự nhiên, sẵn sàng trao đổi và hợp tác với giáo viên trong hoạt động." },
  { score: 5, description: "Tự tin giao tiếp, hợp tác tốt và vui vẻ chia sẻ về mô hình hoặc câu chuyện của mình. Thể hiện sự hào hứng với môn học." },
];

export const roboticsCapabilities = {
  recognition: { name: "I. Năng lực nhận biết và khám phá", levels: recognitionLevels },
  assembly: { name: "II. Năng lực lắp ráp và tư duy không gian", levels: assemblyLevels },
  programming: { name: "III. Năng lực lập trình", levels: programmingLevels },
  communication: { name: "IV. Năng lực giao tiếp và hợp tác", levels: communicationLevels },
};
