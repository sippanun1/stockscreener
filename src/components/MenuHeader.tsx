import { Navbar, NavbarBrand } from "flowbite-react";
import { NavLink } from "react-router-dom";
import goodtradeLogo from "../assets/goodtrade.svg";

export default function MenuHeader() {
  return (
    <Navbar className="pl-[53px] pr-[53px]">
      <NavbarBrand href="/">
        <img
          src={goodtradeLogo}
          className="w-[97px] h-[97px]pl-[53px]"
        />
      </NavbarBrand>
      <div className="flex justify-end gap-8 px-6">
        <NavLink 
          to="/" 
          className={({ isActive }) => 
            `text-[#F8FAFC] hover:text-[#00FF88] text-base font-medium ${isActive ? 'text-[#00FF88]' : ''}`
          }
        >
          Screener
        </NavLink>
        <NavLink 
          to="/analytics" 
          className={({ isActive }) => 
            `text-[#F8FAFC] hover:text-[#00FF88] text-base font-medium ${isActive ? 'text-[#00FF88]' : ''}`
          }
        >
          Analytics
        </NavLink>
      </div>
    </Navbar>
  );
}

