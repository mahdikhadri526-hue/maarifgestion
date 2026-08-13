import { AlertTriangle, Building2, LogOut, Shield, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";

export function UserMenu({ onOpenAdmin, onOpenAnomalies }: { onOpenAdmin: () => void; onOpenAnomalies?: () => void }) {
  const { user, role, isAdmin, isRegionalAdmin, signOut, pdv, selectPdv, multiPdvEnabled } = useAuth();
  if (!user) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
          <UserIcon className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline truncate max-w-[140px]">{user.email}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="text-sm font-medium">{user.email}</div>
          <div className="text-xs text-muted-foreground capitalize">Rôle : {role ?? "—"}</div>
          {pdv && (
            <div className="text-xs text-muted-foreground">PDV : {pdv.name}</div>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {multiPdvEnabled && (
          <DropdownMenuItem onClick={() => selectPdv(null)}>
            <Building2 className="h-4 w-4 mr-2" /> Changer de point de vente
          </DropdownMenuItem>
        )}
        {(isAdmin || isRegionalAdmin) && (
          <DropdownMenuItem onClick={onOpenAdmin}>
            <Shield className="h-4 w-4 mr-2" />
            {isAdmin ? "Gestion des utilisateurs" : "Permissions de mes PDV"}
          </DropdownMenuItem>
        )}
        {(isAdmin || isRegionalAdmin) && onOpenAnomalies && (
          <DropdownMenuItem onClick={onOpenAnomalies}>
            <AlertTriangle className="h-4 w-4 mr-2" /> Centre des anomalies
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" /> Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
