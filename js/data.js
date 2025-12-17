const CET_DATA = (() => {
  const notices = [
    { title: "2025年上半年CET报名公告", content: "报名时间为3月1日至3月10日，请各校按时组织。", date: "2025-02-20" },
    { title: "准考证打印开放时间", content: "打印时间预计考前7天开放，具体以学校通知为准。", date: "2025-05-20" },
    { title: "成绩发布时间说明", content: "成绩预计考后45天发布，请关注本网站公告。", date: "2025-06-30" }
  ];
  const batches = [
    { id: "2025H1", name: "2025年上半年", registerStart: "2025-03-01", registerEnd: "2025-03-10", examDate: "2025-06-15" },
    { id: "2025H2", name: "2025年下半年", registerStart: "2025-09-01", registerEnd: "2025-09-10", examDate: "2025-12-15" }
  ];
  const centers = [
    { id: "LCU-01", name: "聊城大学西校区考点", address: "山东省聊城市东昌府区东外环路1号" },
    { id: "LCU-02", name: "聊城大学东校区考点", address: "山东省聊城市花园北路7号" },
    { id: "LCU-03", name: "聊城大学体育馆考点", address: "聊城市花园北路体育馆内" }
  ];
  const demoScores = {
    "2025H1-CET4-00000001": { total: 512, listening: 180, reading: 195, writing: 137 },
    "2025H1-CET6-00000001": { total: 486, listening: 165, reading: 188, writing: 133 }
  };
  return { notices, batches, centers, demoScores };
})();

