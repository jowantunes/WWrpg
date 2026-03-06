import { api } from "../api.js";
import { navigate } from "../app.js";

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const HERO_SLIDES = [
  {
    title: "Universo Limiar",
    subtitle: "Dossiês, conexões e evidências.",
    ctaText: "Iniciar Protocolo",
    onClick: () => navigate("/categorias/personagem"),
    bgImage: "/frontend/uploads/bannerlimiar_.png"
  },
  {
    title: "Arquivos Recentes",
    subtitle: "Rastreia as últimas alterações do caso.",
    ctaText: "Ver Atualizações",
    onClick: () => document.querySelector("#grid-home")?.scrollIntoView({ behavior: "smooth" }),
    bgImage: "/frontend/uploads/brenin.png"
  },
  {
    title: "Conexões do Grafo",
    subtitle: "Liga entidades e cria relações tipadas.",
    ctaText: "Abrir Conexões",
    onClick: () => navigate("/categorias/organizacao"),
    bgImage: "/frontend/uploads/hero_conexoes_grafo.png"
  }
];

export async function renderHome(root) {
  root.innerHTML = `
    <style>
      #hero-carousel {
        position: relative;
        width: 100%;
        height: 600px;
        border-radius: var(--radius-lg);
        overflow: hidden;
        margin-bottom: 40px;
        border: 1px solid var(--bg-surface-alt);
        box-shadow: var(--shadow-base);
      }
      #hero-bg {
        position: absolute;
        inset: 0;
        background-size: cover;
        background-position: center;
        transition: background-image 0.8s ease-in-out;
        opacity: 0.9;
      }
      .hero-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, rgba(43, 67, 97, 0.4) 0%, rgba(16, 25, 36, 0.8) 100%);
        z-index: 1;
      }
      .hero-content {
        position: absolute;
        bottom: 60px;
        left: 40px;
        z-index: 2;
        transition: opacity 0.4s, transform 0.4s;
      }
      .hero-nav-btn {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        z-index: 3;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: white;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        backdrop-filter: blur(4px);
        cursor: pointer;
        display: none;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        font-size: 18px;
      }
      #hero-carousel:hover .hero-nav-btn {
        display: flex;
      }
      .hero-nav-btn:hover {
        background: var(--brand-accent);
        border-color: var(--brand-accent);
      }
      #hero-prev { left: 20px; }
      #hero-next { right: 20px; }
      
      .hero-dots {
        position: absolute;
        bottom: 30px;
        right: 40px;
        display: flex;
        gap: 8px;
        z-index: 3;
      }
      .hero-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: rgba(229, 229, 229, 0.25);
        cursor: pointer;
        transition: background 0.3s, transform 0.2s;
      }
      .hero-dot:hover { transform: scale(1.2); }
      .hero-dot.active {
        background: var(--brand-accent);
        width: 24px;
        border-radius: 4px;
      }
      
      @media (prefers-reduced-motion: reduce) {
        #hero-bg { transition: none !important; }
        .hero-content { transition: none !important; }
      }
      @media (max-width: 600px) {
        .hero-nav-btn { display: none !important; }
        .hero-content { left: 20px; bottom: 40px; }
        .hero-dots { right: 50%; transform: translateX(50%); }
      }
    </style>

    <!-- Hero Carousel -->
    <div id="hero-carousel">
       <div id="hero-bg"></div>
       <div class="hero-overlay"></div>
       
       <div class="hero-content" id="hero-content">
          <h1 class="title-paranormal" id="hero-title" style="font-size:42px; margin:0; text-shadow: 0 4px 12px rgba(0,0,0,0.8);"></h1>
          <p id="hero-subtitle" style="margin: 8px 0 0 0; color:var(--text-muted); font-size:14px; text-transform:uppercase; letter-spacing:1px;"></p>
          <button id="hero-btn" class="btn-limiar btn-primary" style="margin-top:20px; padding:12px 32px; font-weight:bold; letter-spacing:1px; text-transform:uppercase; border-radius: var(--radius-md);"></button>
       </div>

       <button id="hero-prev" class="hero-nav-btn" aria-label="Anterior">⟨</button>
       <button id="hero-next" class="hero-nav-btn" aria-label="Próximo">⟩</button>

       <div class="hero-dots" id="hero-dots"></div>
    </div>

    <!-- Seção: Últimas Atualizações -->
    <h2 class="title-paranormal" style="font-size:20px; border-bottom:1px solid var(--bg-surface-alt); padding-bottom:8px; margin-bottom:24px; display:flex; align-items:center; gap:8px; margin-top:20px;">
       <span style="color:var(--brand-accent);">⚡</span> Últimas Atualizações
    </h2>
    <div id="grid-home" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:20px;">
       <p style="color:var(--text-muted);">Decodificando log de arquivos...</p>
    </div>
  `;

  // Carousel Logic
  let activeIndex = 0;
  let timer = null;
  const slides = HERO_SLIDES;
  const carousel = root.querySelector("#hero-carousel");
  const bg = root.querySelector("#hero-bg");
  const title = root.querySelector("#hero-title");
  const subtitle = root.querySelector("#hero-subtitle");
  const btn = root.querySelector("#hero-btn");
  const dotsContainer = root.querySelector("#hero-dots");
  const content = root.querySelector("#hero-content");

  function updateSlide(index) {
    activeIndex = index;
    const slide = slides[activeIndex];

    // Fade content effect
    content.style.opacity = "0";
    content.style.transform = "translateY(10px)";

    setTimeout(() => {
      bg.style.backgroundImage = `url('${slide.bgImage}')`;
      title.textContent = slide.title;
      subtitle.textContent = slide.subtitle || "";
      btn.textContent = slide.ctaText;

      // Update dots
      const dots = dotsContainer.querySelectorAll(".hero-dot");
      dots.forEach((d, i) => {
        d.classList.toggle("active", i === activeIndex);
      });

      content.style.opacity = "1";
      content.style.transform = "translateY(0)";
    }, 300);
  }

  function nextSlide() {
    updateSlide((activeIndex + 1) % slides.length);
  }

  function prevSlide() {
    updateSlide((activeIndex - 1 + slides.length) % slides.length);
  }

  function startTimer() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (slides.length <= 1) return;

    stopTimer();
    timer = setInterval(() => {
      // Cleanup check: stop if carousel no longer in DOM
      if (!document.body.contains(carousel)) {
        stopTimer();
        return;
      }
      nextSlide();
    }, 7000);
  }

  function stopTimer() {
    if (timer) clearInterval(timer);
  }

  // Initial Content
  if (slides.length > 1) {
    slides.forEach((_, i) => {
      const dot = document.createElement("div");
      dot.className = `hero-dot ${i === 0 ? "active" : ""}`;
      dot.onclick = () => {
        updateSlide(i);
        stopTimer();
        startTimer();
      };
      dotsContainer.appendChild(dot);
    });

    root.querySelector("#hero-next").onclick = () => { nextSlide(); stopTimer(); startTimer(); };
    root.querySelector("#hero-prev").onclick = () => { prevSlide(); stopTimer(); startTimer(); };

    carousel.onmouseenter = stopTimer;
    carousel.onmouseleave = startTimer;
  } else {
    root.querySelector("#hero-prev").style.display = "none";
    root.querySelector("#hero-next").style.display = "none";
  }

  btn.onclick = () => {
    if (slides[activeIndex].onClick) slides[activeIndex].onClick();
  };

  updateSlide(0);
  startTimer();

  // ── Seção: Últimas Atualizações ───────────────────────────
  const grid = root.querySelector("#grid-home");
  try {
    let results = await api.listarPaginas();
    if (results.length > 0 && results[0].data_atualizacao) {
      results.sort((a, b) => new Date(b.data_atualizacao) - new Date(a.data_atualizacao));
    } else {
      results.sort((a, b) => b.id - a.id);
    }

    const slice = results.slice(0, 10);
    if (slice.length === 0) {
      grid.innerHTML = `<p style="color:var(--text-muted); font-style:italic;">O diretório está vazio.</p>`;
    } else {
      grid.innerHTML = slice.map(p => {
        const imgHtml = p.imagem
          ? `<img src="${escapeHtml(p.imagem)}" style="width:60px; height:60px; object-fit:cover; border-radius:var(--radius-sm); border:1px solid var(--bg-surface-alt);" />`
          : `<div style="width:60px; height:60px; background:var(--bg-app); border:1px solid var(--bg-surface-alt); border-radius:var(--radius-sm); display:flex; align-items:center; justify-content:center; color:var(--text-muted); font-size:10px;">Vazio</div>`;
        const dateStr = p.data_atualizacao || "";
        const prettyDate = dateStr.includes(" ") ? dateStr.split(" ")[0] : dateStr;

        return `
           <div class="card-noir" data-id="${p.id}" style="display:flex; align-items:center; gap:16px; padding:12px; cursor:pointer;">
              ${imgHtml}
              <div style="flex-grow:1; min-width:0;">
                 <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <span style="font-size:10px; font-weight:bold; letter-spacing:1px; text-transform:uppercase; color:var(--brand-accent); background:rgba(193,18,31,0.1); padding:2px 6px; border-radius:4px;">${escapeHtml(p.tipo)}</span>
                    <span style="font-size:11px; color:var(--text-muted);">${escapeHtml(prettyDate)}</span>
                 </div>
                 <div class="title-paranormal" style="font-size:14px; margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(p.titulo)}</div>
              </div>
           </div>
         `;
      }).join("");

      grid.onclick = (e) => {
        const card = e.target.closest(".card-noir");
        if (card) navigate(`/entity/${card.dataset.id}`);
      };
    }
  } catch (e) {
    grid.innerHTML = `<p style="color:var(--brand-danger);">Erro de carregamento remoto: ${e.message}</p>`;
  }
}