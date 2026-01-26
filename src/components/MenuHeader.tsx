import { Navbar, NavbarBrand } from "flowbite-react";
import { NavLink } from "react-router-dom";
import goodtradeLogo from "../assets/goodtrade.svg";

/**
 * Helper function to generate NavLink className based on active state
 * Includes accessible focus styles for keyboard navigation
 */
const getNavLinkClass = (isActive: boolean): string => {
  const baseClasses = "text-base font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFB7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F151F] rounded";
  
  if (isActive) {
    return `${baseClasses} text-[#00FFB7]`;
  }
  
  return `${baseClasses} text-[#F8FAFC] hover:text-[#00FFB7]`;
};

export default function MenuHeader() {
  return (
    <Navbar className="px-4 sm:px-6 lg:px-[53px] !bg-[#000000]">
      <NavbarBrand href="/">
        <img
          src={goodtradeLogo}
          className="w-16 h-16 sm:w-20 sm:h-20 lg:w-[97px] lg:h-[97px]"
        />
      </NavbarBrand>
      <div className="flex justify-end gap-4 sm:gap-8 px-2 sm:px-6">
        <NavLink 
          to="/" 
          className={({ isActive }) => getNavLinkClass(isActive)}
        >
          Screener
        </NavLink>
      </div>
    </Navbar>
  );
}
