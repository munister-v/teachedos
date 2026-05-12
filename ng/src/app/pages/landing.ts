import { Component, AfterViewInit, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  imports: [RouterLink],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
  encapsulation: ViewEncapsulation.None
})
export class Landing implements AfterViewInit {
  ngAfterViewInit(): void {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          observer.unobserve(e.target);
        }
      });
    }, { threshold: 0.15 });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    document.querySelectorAll('.faq-q').forEach(q => {
      q.addEventListener('click', () => {
        q.closest('.faq-item')?.classList.toggle('open');
      });
    });
  }
}
