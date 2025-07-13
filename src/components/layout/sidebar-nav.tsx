'use client';

import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  ClipboardCheck,
  GraduationCap,
  Settings,
  LogOut,
  Users,
  ShoppingCart,
  Briefcase,
  BookText,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { LoggedUser } from '@/app/actions';

const navItemsDefinition = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Administrador', 'Gerente', 'Colaborador'] },
  { href: '/avaliacoes', label: 'Avaliações', icon: ClipboardCheck, roles: ['Administrador', 'Gerente', 'Colaborador'] },
  { href: '/treinamentos', label: 'Treinamentos', icon: GraduationCap, roles: ['Administrador', 'Gerente', 'Colaborador'] },
  { href: '/diario', label: 'Diário', icon: BookText, roles: ['Administrador', 'Gerente'] },
  { href: '/usuarios', label: 'Usuários', icon: Users, roles: ['Administrador'] },
  { href: '/compras', label: 'Lista de Compras', icon: ShoppingCart, roles: ['Administrador', 'Gerente'] },
  { href: '/setores', label: 'Setores', icon: Briefcase, roles: ['Administrador'] },
];

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [visibleNavItems, setVisibleNavItems] = useState<typeof navItemsDefinition>([]);

  useEffect(() => {
    const userString = localStorage.getItem('user');
    if (userString) {
      const user: LoggedUser = JSON.parse(userString);
      const filteredItems = navItemsDefinition.filter(item => 
        item.roles.includes(user.role)
      );
      setVisibleNavItems(filteredItems);
    }
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/');
  };


  return (
    <>
      <SidebarHeader className="p-4">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h2 className="text-xl font-bold font-headline tracking-tight group-data-[collapsible=icon]:hidden">
            Humance
          </h2>
        </Link>
      </SidebarHeader>

      <SidebarMenu className="flex-1 p-2">
        {visibleNavItems.map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={pathname === item.href}
              tooltip={{ children: item.label }}
            >
              <Link href={item.href}>
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>

      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={{children: "Configurações"}}>
                <Link href="#">
                    <Settings className="h-5 w-5" />
                    <span>Configurações</span>
                </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} tooltip={{children: "Sair"}}>
                <LogOut className="h-5 w-5" />
                <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
