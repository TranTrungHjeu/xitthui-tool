export interface CapabilityLevel {
  score: 1 | 2 | 3 | 4 | 5;
  description: string;
}

export const kiro4RecognitionLevels: CapabilityLevel[] = [
  { score: 1, description: "Bé còn gặp khó khăn trong việc phân biệt rõ hình dạng, màu sắc của các chi tiết lắp ráp. Cần nhiều sự hỗ trợ từ giáo viên." },
  { score: 2, description: "Bé đã bước đầu phân biệt được màu sắc và hình dạng của các chi tiết lắp ráp. Tuy nhiên, vẫn còn nhầm lẫn và cần giáo viên nhắc lại." },
  { score: 3, description: "Bé nhận diện đúng hình dạng và màu sắc của các chi tiết lắp ráp." },
  { score: 4, description: "Bé nhận diện đúng màu sắc, hình dạng của các chi tiết lắp ráp. Ghi nhớ được tên của mô hình trong buổi trải nghiệm." },
  { score: 5, description: "Bé nhận diện đúng hình dạng và màu sắc của các chi tiết lắp ráp. Tên của mô hình trong buổi trải nghiệm. Thể hiện sự sáng tạo trong mô hình." },
];

export const kiro4AssemblyLevels: CapabilityLevel[] = [
  { score: 1, description: "Bé gặp nhiều khó khăn trong việc chọn đúng khối chi tiết và lắp ráp theo hướng dẫn. Bé lắp ráp sai nhiều và cần sự hỗ trợ sát sao từ giáo viên." },
  { score: 2, description: "Bé có thể chọn đúng chi tiết và lắp ráp theo hướng dẫn. Tuy nhiên, bé vẫn gặp khó khăn trong việc xác định hướng và vị trí của các chi tiết, cần giáo viên hỗ trợ nhiều." },
  { score: 3, description: "Bé đã chọn đúng khối gạch/chi tiết và lắp ráp theo hướng dẫn. Bé đã xác định được hướng và vị trí lắp ráp nhưng đôi khi mắc lỗi, cần giáo viên hỗ trợ chỉnh sửa lại." },
  { score: 4, description: "Bé chọn đúng khối gạch/chi tiết và lắp ráp theo hướng dẫn. Bé xác định được hướng và vị trí chính xác, đôi khi lắp ráp sai nhưng có thể sửa lại khi nhận được gợi ý từ giáo viên." },
  { score: 5, description: "Bé chọn đúng khối gạch/chi tiết và lắp ráp chính xác theo hướng dẫn. Bé có thể tự xác định hướng, vị trí lắp ráp; nếu lắp ráp sai, bé có thể tự sửa lại mà không cần nhiều sự hỗ trợ từ giáo viên." },
];

export const kiro4ProgrammingLevels: CapabilityLevel[] = [
  { score: 1, description: "Bé chưa thể thao tác kéo thả khối lệnh lập trình. Dù có sự hỗ trợ từ giáo viên, bé vẫn gặp nhiều khó khăn khi thực hiện." },
  { score: 2, description: "Bé có thể kéo thả khối lệnh, nhưng chương trình chưa hoạt động và cần giáo viên hỗ trợ để chỉnh sửa." },
  { score: 3, description: "Bé có thể kéo thả khối lệnh và lập trình để mô hình hoạt động đơn giản, nhưng vẫn cần giáo viên gợi ý trong quá trình thực hiện." },
  { score: 4, description: "Bé có thể kéo thả khối lệnh và lập trình mô hình hoạt động đúng theo yêu cầu mà không cần nhiều sự hỗ trợ." },
  { score: 5, description: "Bé thao tác thành thạo việc kéo thả khối lệnh và lập trình chính xác theo yêu cầu, chủ động điều chỉnh thông số trong chương trình của mình." },
];

export const kiro4CommunicationLevels: CapabilityLevel[] = [
  { score: 1, description: "Bé chưa phản hồi hoặc chưa hợp tác với giáo viên trong quá trình học." },
  { score: 2, description: "Bé có phản hồi ngắn nhưng chưa thực sự hợp tác với giáo viên, chưa tham gia vào hoạt động lắp ráp mô hình." },
  { score: 3, description: "Bé có phản hồi và hợp tác với giáo viên, tuy nhiên vẫn còn rụt rè, chưa thực sự tự tin khi tham gia trải nghiệm." },
  { score: 4, description: "Bé chủ động giao tiếp, sẵn sàng trò chuyện và hợp tác với giáo viên trong các hoạt động." },
  { score: 5, description: "Bé giao tiếp tự tin, hợp tác tốt với giáo viên và sẵn sàng chia sẻ về mô hình hoặc câu chuyện của mình." },
];

export const kiro4PlusCapabilities = {
  recognition: { name: "I. Năng lực nhận biết và khám phá", levels: kiro4RecognitionLevels },
  assembly: { name: "II. Năng lực lắp ráp và tư duy không gian", levels: kiro4AssemblyLevels },
  programming: { name: "III. Năng lực lập trình", levels: kiro4ProgrammingLevels },
  communication: { name: "IV. Năng lực giao tiếp và hợp tác", levels: kiro4CommunicationLevels },
};
