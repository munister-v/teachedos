import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-bottom-tabs',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './bottom-tabs.html',
  styleUrl: './bottom-tabs.scss',
})
export class BottomTabs {}
