export interface CodingCriterion {
  key: string;
  label: string;
}

export const computationalThinkingCriteria: CodingCriterion[] = [
  { key: "understand_digital_products", label: "Hiểu được các sản phẩm số được tạo ra bởi việc lập trình" },
  { key: "explain_knowledge", label: "Trình bày được ý nghĩa, chức năng của các kiến thức vừa học" },
  { key: "apply_knowledge", label: "Áp dụng được các kiến thức đã học vào sản phẩm" },
  { key: "develop_features", label: "Vận dụng được các kiến thức vừa học phát triển các chức năng cho sản phẩm" },
];

export const creativityCriteria: CodingCriterion[] = [
  { key: "follow_instructions", label: "Nghiêm túc làm theo sự hướng dẫn của giáo viên" },
  { key: "suggest_ideas", label: "Có đề xuất ý tưởng mới để phát triển trò chơi" },
  { key: "create_features", label: "Chủ động sáng tạo các tính năng mới trên dự án có sẵn" },
  { key: "build_new_projects", label: "Có ý tưởng xây dựng các dự án khác dựa trên kiến thức đã học" },
];

export const communicationCriteria: CodingCriterion[] = [
  { key: "interact_with_teacher", label: "Có tương tác, trao đổi với giáo viên trong quá trình học." },
  { key: "share_problems", label: "Mạnh dạn trao đổi với giáo viên về những vấn đề đang gặp phải" },
  { key: "propose_ideas", label: "Chủ động đề xuất ý tưởng bản thân để xây dựng sản phẩm, giải quyết vấn đề" },
  { key: "present_product", label: "Tự tin thuyết trình về các tính năng của sản phẩm đã thực hiện" },
];

export const problemSolvingCriteria: CodingCriterion[] = [
  { key: "aware_of_problems", label: "Ý thức được các vấn đề phát sinh trong quá trình lập trình" },
  { key: "find_problems", label: "Chủ động tìm kiếm vấn đề đang gặp phải" },
  { key: "suggest_solutions", label: "Đề xuất được giải pháp để giải quyết vấn đề gặp phải" },
  { key: "solve_problems", label: "Thực hiện xử lý vấn đề đang gặp phải" },
];

export const computerSkillsCriteria: CodingCriterion[] = [
  { key: "use_mouse_keyboard", label: "Thao tác tốt với chuột và bàn phím" },
  { key: "know_programming_app", label: "Gọi tên và trình bày được chức năng của ứng dụng lập trình" },
  { key: "use_programming_app", label: "Sử dụng tốt ứng dụng lập trình (Scratch, GameMaker, VSC)" },
  { key: "use_internet", label: "Thực hiện sử dụng Internet để phát triển ý tưởng, hoàn thiện dự án" },
];

export const codingCriteriaGroups = {
  computationalThinking: { name: "Tư duy máy tính, tư duy thuật toán", criteria: computationalThinkingCriteria },
  creativity: { name: "Tư duy sáng tạo", criteria: creativityCriteria },
  communication: { name: "Kỹ năng giao tiếp, hợp tác", criteria: communicationCriteria },
  problemSolving: { name: "Kỹ năng giải quyết vấn đề", criteria: problemSolvingCriteria },
  computerSkills: { name: "Kỹ năng sử dụng máy tính", criteria: computerSkillsCriteria },
};
