import React from "react";
import PostList from "./components/PostList";

const posts = [
  {
    id: "1",
    title: "크레스티드 게코 베이비",
    content: "<p>크레스티드 게코(베이비 입니다~~)</p>",
    author: "익명",
    time: "2025-12-20T06:47:18.413+00:00",
  },
  {
    id: "2",
    title: "글쓰기 기능 가이드",
    content: "<p>관리자가 쓴 글입니다</p>",
    author: "익명",
    time: "2025-12-20T07:22:25.184+00:00",
  },
];

function App() {
  return (
    <div>
      <h1>나의 게시판</h1>
      <PostList posts={posts} />
    </div>
  );
}

export default App;
