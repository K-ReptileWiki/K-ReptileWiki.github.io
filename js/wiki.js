function initWiki(pageId) {
  /* 좋아요 */
  const likeKey = "like_" + pageId;
  const contribKey = "contrib_" + pageId;

  let likes = JSON.parse(localStorage.getItem(likeKey)) || {
    count: 0,
    users: []
  };

  document.getElementById("likeCount").textContent = likes.count;

  window.like = function () {
    const user = document.getElementById("username").value.trim();
    const msg = document.getElementById("likeMsg");

    if (!user) {
      msg.textContent = "닉네임을 입력하세요.";
      return;
    }
    if (likes.users.includes(user)) {
      msg.textContent = "이미 하트를 눌렀습니다.";
      return;
    }

    likes.count++;
    likes.users.push(user);
    localStorage.setItem(likeKey, JSON.stringify(likes));

    document.getElementById("likeCount").textContent = likes.count;
    msg.textContent = "하트 완료 ❤️";
  };

  /* 기여 */
  let contribs = JSON.parse(localStorage.getItem(contribKey)) || [];
  const list = document.getElementById("contributions");

  function render() {
    list.innerHTML = "";
    contribs.forEach(c => {
      const li = document.createElement("li");
      li.textContent = `${c.user}: ${c.text}`;
      list.appendChild(li);
    });
  }
  render();

  window.addContribution = function () {
    const user = document.getElementById("contributor").value.trim();
    const text = document.getElementById("content").value.trim();
    if (!user || !text) return;

    contribs.push({ user, text });
    localStorage.setItem(contribKey, JSON.stringify(contribs));
    render();
    document.getElementById("content").value = "";
  };
}
