// src/components/PostList.js
import React from "react";

function PostList({ posts }) {
  return (
    <div>
      <h2>📌 게시판 글 목록</h2>
      <ul>
        {posts.map((post) => (
          <li key={post.id} style={{ marginBottom: "1rem" }}>
            <h3>{post.title}</h3>
            <p>✍ 작성자: {post.author}</p>
            <p>🕒 작성 시간: {new Date(post.time).toLocaleString()}</p>
            <div
              style={{ border: "1px solid #ddd", padding: "0.5rem", marginTop: "0.5rem" }}
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PostList;
